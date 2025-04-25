import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

import { loggedProcedure, router } from '../../trpcFactory';

const GeoNameSchema = z.object({
  toponymName: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  geonameId: z.number(),
  countryCode: z.string(),
  countryName: z.string(),
});

export const getGeoNames = router({
  getGeoNames: loggedProcedure
    .input(
      z.object({
        q: z.string().min(2).max(255),
      }),
    )
    .output(
      z.object({
        geoname: z.array(GeoNameSchema).optional().default([]),
      }),
    )
    .query(async ({ input }) => {
      const { q } = input;
      const url = `https://secure.geonames.org/search?q=${q}&username=scottoneproject`;

      const res = await fetch(url);

      const data = await res.text();

      console.log('DATA', data);

      const parser = new XMLParser();
      const jsonData = parser.parse(data) as {
        geonames: {
          geoname: Array<z.infer<typeof GeoNameSchema>>;
        };
      };

      return jsonData.geonames;
    }),
});
