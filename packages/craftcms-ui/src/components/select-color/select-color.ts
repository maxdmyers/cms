import {html, LitElement} from 'lit';
import {property} from 'lit/decorators.js';
import {colors as paletteColors} from '@src/constants/colors';
import {emitChange, emitInput} from '@src/utilities/form-events';
import {t} from '@src/utilities/translate';
import styles from './select-color.styles.js';
import '../select-rich/select-rich.js';
import '../option/option.js';

/**
 * Title-case a color value for display (e.g. `red` -> `Red`).
 */
function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * @summary A color picker built on top of the rich select. Renders one option
 * per color from `constants/colors` (or {@link CraftSelectColor.colors}, when
 * narrowed), with an optional "transparent" option.
 *
 * @since 1.0
 *
 * @fires input - Emitted when a color is picked.
 * @fires change - Emitted when a color is picked. Picking is a commit, so it
 *   follows each `input`.
 *
 * @cssproperty [--c-select-color-swatch-edge=rgb(0 0 0 / 15%)] - Edge of the
 *   no-color swatch, which would otherwise blend into a dark surface. The dark
 *   theme lightens it.
 * @cssproperty [--c-select-color-swatch-ring=transparent] - Ring around every
 *   swatch. The dark theme sets a faint one.

 */
export default class CraftSelectColor extends LitElement {
  static override styles = [styles];

  /**
   * Field label, forwarded to the underlying rich select.
   */
  @property()
  label = '';

  /**
   * Field name, forwarded to the underlying rich select.
   */
  @property()
  name = '';

  /**
   * The currently selected color value.
   */
  @property()
  value = '';

  /**
   * When enabled, a blank option (labeled {@link blankLabel}) is prepended
   * to the list of colors.
   */
  @property({type: Boolean, reflect: true, attribute: 'allow-transparent'})
  allowTransparent = false;

  /**
   * Label for the blank option (default "Transparent").
   */
  @property({attribute: 'blank-label'})
  blankLabel: string | null = null;

  /**
   * Offered colors, in order. Defaults to the shared palette.
   */
  @property({type: Array})
  colors: string[] = [...paletteColors];

  /**
   * Disables the control, forwarded to the underlying rich select.
   */
  @property({type: Boolean, reflect: true})
  disabled = false;

  /**
   * Shows the selected color without letting it be changed.
   */
  @property({type: Boolean, reflect: true, attribute: 'readonly'})
  readOnly = false;

  /**
   * Marks the control as required, forwarded to the underlying rich select.
   */
  @property({type: Boolean, reflect: true})
  required = false;

  /**
   * Marks the value as invalid, forwarded to the underlying rich select.
   */
  @property({type: Boolean, reflect: true})
  invalid = false;

  /**
   * Renders a color swatch for the given color value. The special `__blank__`
   * value (the "Transparent" option) reuses the checkerboard treatment so it
   * reads as "no color". Other swatches match the header of a card in that
   * color, fill and border alike.
   *
   * Structural styling is applied inline (rather than via the component's
   * scoped stylesheet) so the rendered node stays self-contained when the
   * rich select copies the selected option's content into its field, where
   * this component's class rules don't apply.
   */
  protected _swatchTemplate(color: string) {
    const isTransparent = color === '__blank__';
    // Every swatch casts a slight shadow and has an edge in its card header's
    // border color (see --c-select-color-swatch-edge for no color's). The dark
    // theme rings them too (see --c-select-color-swatch-ring).
    const shadows = [
      '0 0 0 1px var(--c-select-color-swatch-ring, transparent)',
      '0 1px 1px rgb(0 0 0 / 20%)',
      `inset 0 0 0 1px ${this._swatchBorder(color)}`,
    ];

    const base =
      'flex:0 0 auto;inline-size:1rem;block-size:1rem;' +
      'border-radius:var(--c-radius-full);' +
      `box-shadow:${shadows.join(', ')};`;

    const transparent =
      'background:' +
      'linear-gradient(45deg, var(--c-color-neutral-fill-quiet) 25%, transparent 25%),' +
      'linear-gradient(-45deg, var(--c-color-neutral-fill-quiet) 25%, transparent 25%),' +
      'linear-gradient(45deg, transparent 75%, var(--c-color-neutral-fill-quiet) 75%),' +
      'linear-gradient(-45deg, transparent 75%, var(--c-color-neutral-fill-quiet) 75%);' +
      'background-position:0 0, 0 0.25rem, 0.25rem -0.25rem, -0.25rem 0;' +
      'background-size:0.5rem 0.5rem;';

    // White cards take the white surface rather than white's own fill.
    const fill =
      color === 'white'
        ? 'var(--c-surface-white)'
        : `var(--c-color-${color}-fill-quiet)`;

    const style = isTransparent
      ? base + transparent
      : base + `background-color:${fill};`;

    return html`<span
      class="select-color__swatch"
      style="${style}"
      aria-hidden="true"
    ></span>`;
  }

  /**
   * The border color of a card header in the given color, mirroring the
   * card's own exceptions for black and white.
   */
  protected _swatchBorder(color: string): string {
    switch (color) {
      case '__blank__':
        return 'var(--c-select-color-swatch-edge, rgb(0 0 0 / 15%))';
      case 'black':
        return 'color-mix(in srgb, var(--c-color-black-on-quiet), transparent 80%)';
      case 'white':
        return 'var(--c-table-border-color)';
      default:
        return `var(--c-color-${color}-border-quiet)`;
    }
  }

  /**
   * Builds a single `<craft-option>` for a color value. The wrapper's flex
   * layout is applied inline so it survives being copied into the field
   * alongside the swatch (see `_swatchTemplate`).
   */
  protected _optionTemplate(color: string, label: string) {
    return html`<craft-option .choiceValue=${color}>
      <span
        class="select-color__option"
        style="display:flex;align-items:center;gap:var(--c-spacing-sm);"
      >
        ${this._swatchTemplate(color)}
        <span class="select-color__label" style="white-space:nowrap;"
          >${label}</span
        >
      </span>
    </craft-option>`;
  }

  /**
   * Keeps the host's value in step with the inner select's and re-emits its
   * event from the host, since the inner one doesn't leave the shadow root
   * with the component as its target.
   */
  protected _handleSelect(event: Event) {
    event.stopPropagation();

    const inner = event.target as {value?: string} | null;
    this.value = inner?.value ?? '';

    if (event.type === 'input') {
      emitInput(this);
    } else {
      emitChange(this);
    }
  }

  protected override render() {
    return html`
      <craft-select-rich
        label=${this.label}
        name=${this.name}
        .value=${this.value}
        .disabled=${this.disabled}
        .readOnly=${this.readOnly}
        .required=${this.required}
        .invalid=${this.invalid}
        @input=${this._handleSelect}
        @change=${this._handleSelect}
      >
        ${this.allowTransparent
          ? this._optionTemplate(
              '__blank__',
              this.blankLabel ?? t('Transparent')
            )
          : ''}
        ${this.colors.map((color) =>
          this._optionTemplate(color, t(titleCase(color)))
        )}
      </craft-select-rich>
    `;
  }
}

if (!customElements.get('craft-select-color')) {
  customElements.define('craft-select-color', CraftSelectColor);
}

declare global {
  interface HTMLElementTagNameMap {
    'craft-select-color': CraftSelectColor;
  }
}
