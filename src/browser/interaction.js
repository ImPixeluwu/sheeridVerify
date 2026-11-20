import { randomInt } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Random integer
const sample = range =>
  randomInt(range.min, range.max + 1);

// Validate the delay range
function validateRange(name, range) {
  if (
    !range ||
    !Number.isSafeInteger(range.min) ||
    !Number.isSafeInteger(range.max) ||
    range.min < 0 ||
    range.max < range.min
  ) {
    throw new TypeError(`Invalid delay range: ${name}`);
  }
}

export function createInteraction(
  config,
  { signal, log = () => {} } = {}
) {
  // Check the configuration
  for (const key of [
    'fieldDelayMs',
    'submitDelayMs',
    'keyDelayMs',
  ]) {
    validateRange(key, config[key]);
  }

  // Abort check
  const checkAbort = () => {
    signal?.throwIfAborted();
  };

  // Unified random wait
  const pause = async (range, stage, field) => {
    checkAbort();

    const durationMs = sample(range);

    log('interaction_delay', {
      stage,
      field,
      durationMs,
    });

    if (durationMs > 0) {
      await delay(durationMs, undefined, { signal });
    }
  };

  return {

    // Wait before operating on a field
    beforeField: field =>
      pause(config.fieldDelayMs, 'fill', field),

    // Wait before operating on a dropdown option
    beforeOption: field =>
      pause(config.fieldDelayMs, 'select_option', field),

    // Wait before submitting
    beforeSubmit: () =>
      pause(config.submitDelayMs, 'submit', 'submit'),

    // Random keyboard input
    async typeText(locator, value, options = {}) {
      const {
        field = 'input',
        clear = true,
        clearMode = 'fill',
      } = options;

      checkAbort();

      // Focus only; repeated clicks would close a dropdown the caller already opened.
      await locator.focus();

      // Default to the fill-based clearing, to avoid shortcuts changing the dropdown control state.
      if (clear) {
        if (clearMode === 'keyboard') {
          await locator.press('ControlOrMeta+A');
          await locator.press('Backspace');
        } else if (clearMode === 'fill') {
          await locator.fill('');
        } else {
          throw new TypeError(`Invalid clearMode: ${clearMode}`);
        }
      }

      // Iterate by Unicode character
      const characters = Array.from(
        String(value ?? '').replace(/\r\n?/g, '\n')
      );

      for (let i = 0; i < characters.length; i++) {
        checkAbort();

        const character = characters[i];

        // Type the current character
        if (character === '\n') {
          await locator.press('Enter');
        } else {
          await locator.pressSequentially(character);
        }

        // Random wait between each character
        if (i < characters.length - 1) {
          await pause(
            config.keyDelayMs,
            'type',
            field
          );
        }
      }

      log('interaction_typed', {
        field,
        characterCount: characters.length,
      });
    },
  };
}
