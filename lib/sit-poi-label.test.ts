import { describe, expect, it } from 'vitest';
import {
  extractSitPoiCategoryLabel,
  extractSitPoiDisplayName,
  extractSitPoiInstanceId,
} from './sit-poi-label';

const museumDraft = {
  _id: '68920f78f672dc48d63a3d99',
  place_instance_id: 'museum_6e67acc1-1f88-4e85-8b46-191b8c20302c',
  place_type: 'museum',
  place_name: 'Musée',
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

describe('extractSitPoiDisplayName', () => {
  it('lit name dans general_info', () => {
    expect(extractSitPoiDisplayName(museumDraft)).toBe(
      "Musée d'Art Moderne André Malraux - MUMA"
    );
  });

  it('ne confond pas place_name avec le nom du lieu', () => {
    expect(extractSitPoiCategoryLabel(museumDraft)).toBe('Musée');
    expect(extractSitPoiDisplayName(museumDraft)).not.toBe('Musée');
  });

  it('expose place_instance_id pour le fetch', () => {
    expect(extractSitPoiInstanceId(museumDraft)).toBe(
      'museum_6e67acc1-1f88-4e85-8b46-191b8c20302c'
    );
  });
});
