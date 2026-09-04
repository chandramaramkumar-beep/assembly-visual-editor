import { assign, setup } from "xstate";

export interface PlaybackContext {
  /** Current position in the trace; -1 means "before the first instruction". */
  stepIndex: number;
  totalSteps: number;
  /** Milliseconds per step; loop compression lowers this for repeated iterations. */
  stepDuration: number;
  /** Student override that forces every loop iteration to play in full. */
  forceFullPlayback: boolean;
  /** Playback rate: 0.5 is half speed, 2 is double. Lower means longer per step. */
  speed: number;
  /** The most recent seek, kept as a persistent thumbnail. Only ever one. */
  jump: { stepIndex: number } | null;
}

export type PlaybackEvent =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "STEP" }
  | { type: "TICK" }
  | { type: "JUMP"; stepIndex: number }
  | { type: "DISMISS_THUMBNAIL" }
  | { type: "TRACE_CHANGED"; totalSteps: number }
  | { type: "SET_DURATION"; duration: number }
  | { type: "SET_SPEED"; speed: number }
  | { type: "TOGGLE_FULL_PLAYBACK" };

export const DEFAULT_STEP_DURATION = 1600;

export const SPEED_OPTIONS = [0.5, 1, 2] as const;

/** How long a landed seek stays on screen before collapsing into the thumbnail. */
export const JUMP_HOLD_MS = 1400;

export const playbackMachine = setup({
  types: {
    context: {} as PlaybackContext,
    events: {} as PlaybackEvent,
    input: {} as { totalSteps: number },
  },
  guards: {
    hasMoreSteps: ({ context }) => context.stepIndex < context.totalSteps - 1,
  },
  delays: {
    stepDelay: ({ context }) => context.stepDuration,
  },
}).createMachine({
  id: "playback",
  initial: "idle",
  context: ({ input }) => ({
    stepIndex: -1,
    totalSteps: input.totalSteps,
    stepDuration: DEFAULT_STEP_DURATION,
    forceFullPlayback: false,
    speed: 1,
    jump: null,
  }),

  on: {
    // Editing the program invalidates the current position entirely.
    TRACE_CHANGED: {
      target: ".idle",
      actions: assign(({ event }) => ({ stepIndex: -1, totalSteps: event.totalSteps, jump: null })),
    },
    SET_DURATION: {
      actions: assign(({ event }) => ({ stepDuration: event.duration })),
    },
    SET_SPEED: {
      actions: assign(({ event }) => ({ speed: event.speed })),
    },
    TOGGLE_FULL_PLAYBACK: {
      actions: assign(({ context }) => ({ forceFullPlayback: !context.forceFullPlayback })),
    },
    RESET: {
      target: ".idle",
      actions: assign({ stepIndex: -1, jump: null }),
    },
    DISMISS_THUMBNAIL: {
      actions: assign({ jump: null }),
    },
  },

  states: {
    idle: {
      on: {
        PLAY: { target: "playing", actions: assign({ stepIndex: 0 }) },
        STEP: {
          target: "paused",
          guard: "hasMoreSteps",
          actions: assign(({ context }) => ({ stepIndex: context.stepIndex + 1 })),
        },
        JUMP: { target: "jumped", actions: assign(({ event }) => ({ stepIndex: event.stepIndex, jump: { stepIndex: event.stepIndex } })) },
      },
    },

    playing: {
      after: {
        stepDelay: [
          {
            guard: "hasMoreSteps",
            target: "playing",
            reenter: true,
            actions: assign(({ context }) => ({ stepIndex: context.stepIndex + 1 })),
          },
          { target: "finished" },
        ],
      },
      on: {
        PAUSE: "paused",
        JUMP: { target: "jumped", actions: assign(({ event }) => ({ stepIndex: event.stepIndex, jump: { stepIndex: event.stepIndex } })) },
      },
    },

    paused: {
      on: {
        PLAY: "playing",
        STEP: {
          guard: "hasMoreSteps",
          actions: assign(({ context }) => ({ stepIndex: context.stepIndex + 1 })),
        },
        JUMP: { target: "jumped", actions: assign(({ event }) => ({ stepIndex: event.stepIndex, jump: { stepIndex: event.stepIndex } })) },
      },
    },

    /**
     * A seek just landed: the jumped-to state is shown in full before it
     * collapses into the corner thumbnail and normal playback resumes.
     */
    jumped: {
      after: {
        [JUMP_HOLD_MS]: "thumbnailParked",
      },
      on: {
        PLAY: "playing",
        PAUSE: "paused",
        JUMP: { target: "jumped", reenter: true, actions: assign(({ event }) => ({ stepIndex: event.stepIndex, jump: { stepIndex: event.stepIndex } })) },
      },
    },

    /** The jump summary is parked as a thumbnail; playback continues forward from here. */
    thumbnailParked: {
      always: { target: "playing" },
    },

    finished: {
      on: {
        PLAY: { target: "playing", actions: assign({ stepIndex: 0 }) },
        JUMP: { target: "jumped", actions: assign(({ event }) => ({ stepIndex: event.stepIndex, jump: { stepIndex: event.stepIndex } })) },
      },
    },
  },
});
