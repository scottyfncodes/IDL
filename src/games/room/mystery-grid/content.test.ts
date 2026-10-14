import { THEMES } from './content';

describe('mystery grid themes', () => {
  it('has at least ten themes with unique ids', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });

  it.each(THEMES.map((t) => [t.id, t] as const))('%s is well formed', (_id, theme) => {
    expect(theme.title.trim()).not.toBe('');
    expect(theme.intro.trim()).not.toBe('');
    expect(theme.categories).toHaveLength(3);
    const names = theme.categories.map((c) => c.name);
    expect(new Set(names).size).toBe(3);
    // first category is people: names are referred to directly
    expect(theme.categories[0].subject).toBe('{}');
    expect(theme.categories.filter((c) => c.ordinal).length).toBeLessThanOrEqual(1);
    for (const cat of theme.categories) {
      expect(cat.items).toHaveLength(4);
      expect(new Set(cat.items.map((i) => i.toLowerCase())).size).toBe(4);
      expect(cat.subject).toContain('{}');
      expect(cat.obj).toContain('{}');
      expect(cat.verb.trim()).not.toBe('');
      expect(cat.negVerb.trim()).not.toBe('');
      // articles belong to the object so "either the X or the Y" reads well
      expect(cat.verb).not.toMatch(/\bthe$/);
      cat.items.forEach((i) => expect(i.trim()).toBe(i));
    }
  });

  it('includes some ordered categories so relational clues appear', () => {
    expect(THEMES.filter((t) => t.categories.some((c) => c.ordinal)).length).toBeGreaterThanOrEqual(5);
  });
});
