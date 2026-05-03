import { BadRequestException, Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Filter = require('bad-words');

/** French additions to the default English wordlist of `bad-words`. */
const FRENCH_BAD_WORDS = [
  'connard',
  'connasse',
  'salope',
  'pute',
  'putain',
  'enculé',
  'enculer',
  'enfoiré',
  'pédé',
  'tapette',
  'baiser',
  'bite',
  'couilles',
  'merde',
  'chiotte',
  'fdp',
  'pd',
  'ntm',
  'tg',
  'fdlp',
];

@Injectable()
export class ContentFilterService {
  private readonly filter: any;

  constructor() {
    this.filter = new Filter();
    this.filter.addWords(...FRENCH_BAD_WORDS);
  }

  /** True if `text` contains profanity. */
  isProfane(text: string | null | undefined): boolean {
    const t = (text ?? '').trim();
    if (!t) return false;
    return this.filter.isProfane(t);
  }

  /**
   * Throws BadRequestException if the text contains profanity.
   * Use at the boundary (controllers/services) before persisting user content.
   */
  assertClean(text: string | null | undefined, fieldName = 'content'): void {
    if (this.isProfane(text)) {
      throw new BadRequestException(
        `${fieldName} contains inappropriate language`,
      );
    }
  }

  /** Replaces detected profanities with `***` (use only when reject is too strict). */
  clean(text: string): string {
    return this.filter.clean(text);
  }
}
