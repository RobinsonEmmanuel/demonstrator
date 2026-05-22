import { describe, expect, it } from 'vitest';
import { parseSitDraftForDisplay } from './sit-draft-display';

const museumDraft = {
  place_instance_id: 'museum_6e67acc1-1f88-4e85-8b46-191b8c20302c',
  blocks: [
    {
      block_id: 'general_info',
      sections: [
        {
          section_id: 'general_info_general',
          fields: [
            {
              field_id: 'name',
              value: "Musée d'Art Moderne André Malraux - MUMA",
            },
          ],
        },
      ],
    },
  ],
};

describe('parseSitDraftForDisplay', () => {
  it('extrait block_id, section_id, field_id et value', () => {
    const blocks = parseSitDraftForDisplay(museumDraft);
    expect(blocks).not.toBeNull();
    expect(blocks![0].id).toBe('general_info');
    expect(blocks![0].sections[0].id).toBe('general_info_general');
    expect(blocks![0].sections[0].fields[0]).toEqual({
      id: 'name',
      value: "Musée d'Art Moderne André Malraux - MUMA",
    });
  });
});
