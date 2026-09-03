"use client";

export default function StudioModelPickerCompact() {
  return (
    <style>{`
      /*
       * Studio model picker final alignment.
       * The native Studio desktop grid was built for 4 fields; the AI picker
       * contains 2 real controls inside the old model slot. On desktop we make
       * the setup row a 15-column grid so the visible controls are five equal
       * widths: title | model | version | aspect | style.
       * This is visual/layout-only. Native select/state/provider logic remains
       * owned by single-episode-studio.tsx.
       */
      .sc-ai-model-field > span:first-child {
        display: none !important;
      }

      .sc-ai-model-picker-host,
      .sc-ai-model-picker-shell,
      .sc-ai-select {
        min-width: 0 !important;
      }

      .sc-ai-model-picker-shell {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 11px !important;
        align-items: end !important;
      }

      .sc-ai-picker-label {
        margin: 0 0 5px !important;
        font-size: 12px !important;
        line-height: 1.2 !important;
        font-weight: 850 !important;
      }

      /* Match .field input/select in single-episode-studio.module.css exactly. */
      .sc-ai-select-trigger {
        box-sizing: border-box !important;
        width: 100% !important;
        height: 43px !important;
        min-height: 43px !important;
        max-height: 43px !important;
        padding: 6px 10px !important;
        gap: 7px !important;
        border-radius: 9px !important;
        overflow: hidden !important;
      }

      .sc-brand-icon.is-large {
        box-sizing: border-box !important;
        width: 21px !important;
        height: 21px !important;
        min-width: 21px !important;
        flex: 0 0 21px !important;
        border-radius: 6px !important;
      }

      .sc-ai-status-dot {
        width: 7px !important;
        height: 7px !important;
        min-width: 7px !important;
        flex: 0 0 7px !important;
        box-shadow: 0 0 0 2px color-mix(in srgb,currentColor 10%,transparent),0 0 8px currentColor !important;
      }

      .sc-ai-select-copy {
        min-width: 0 !important;
        line-height: 1 !important;
      }

      .sc-ai-select-copy strong {
        font-size: 13px !important;
        line-height: 1.15 !important;
        font-weight: 800 !important;
      }

      /* The standard Studio selects are single-line. Keep the richer subtitle
         in the opened menu, but remove it from the closed field so height is
         truly identical to the other controls. */
      .sc-ai-select-trigger .sc-ai-select-copy small {
        display: none !important;
      }

      .sc-ai-select-chevron {
        flex: 0 0 auto !important;
        font-size: 17px !important;
        line-height: 1 !important;
        transform: none !important;
      }

      .sc-ai-lock {
        width: 15px !important;
        height: 15px !important;
        flex: 0 0 15px !important;
      }

      /* Five equal visible controls on desktop.
         Child order in setupGrid:
         1 title, 2 model wrapper (contains model + version),
         3 aspect, 4 style, 5 story, 6 timing. */
      @media (min-width: 981px) {
        #setup :has(> .sc-ai-model-field) {
          grid-template-columns: repeat(15, minmax(0, 1fr)) !important;
        }

        #setup :has(> .sc-ai-model-field) > :nth-child(1) {
          grid-column: span 3 !important;
        }

        #setup :has(> .sc-ai-model-field) > .sc-ai-model-field {
          grid-column: span 6 !important;
        }

        #setup :has(> .sc-ai-model-field) > :nth-child(3),
        #setup :has(> .sc-ai-model-field) > :nth-child(4) {
          grid-column: span 3 !important;
        }

        #setup :has(> .sc-ai-model-field) > :nth-child(5) {
          grid-column: span 9 !important;
        }

        #setup :has(> .sc-ai-model-field) > :nth-child(6) {
          grid-column: span 6 !important;
        }
      }

      @media (max-width: 980px) {
        .sc-ai-model-field > span:first-child {
          display: none !important;
        }
      }

      @media (max-width: 820px) {
        .sc-ai-model-field > span:first-child {
          display: block !important;
        }

        .sc-ai-model-picker-shell {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  );
}
