import { XMLParser } from 'fast-xml-parser';
import withRateLimited from '../../middlewares/withRateLimited';
import { z } from 'zod';

import { loggedProcedure, router } from '../../trpcFactory';
import withAuthenticated from '../../middlewares/withAuthenticated';

type GeoName = {
  toponymName: string;
  name: string;
  lat: number;
  lng: number;
  geonameId: number;
  countryCode: string;
  countryName: string;
};

// const meta: OpenApiMeta = {
// openapi: {
// enabled: true,
// method: 'POST',
// path: '/organization',
// protect: true,
// tags: ['organization'],
// summary: 'Create organization',
// },
// };

export const getGeoNames = router({
  getGeoNames: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    // .meta(meta)
    .input(
      z.object({
        q: z.string().min(2).max(255),
      }),
    )
    .output(
      z.object({
        geonames: z.array(z.string()).optional().default([]),
      }),
    )
    .query(async ({ input }) => {
      const { q } = input;
      const url = `https://secure.geonames.org/search?q=${q}&username=${process.env.GEONAMES_USERNAME}`;

      const res = await fetch(url);

      const data = await res.text();

      const parser = new XMLParser();
      const jsonData = parser.parse(data) as {
        geonames: {
          geoname: Array<GeoName>;
        };
      };

      const geoNameSet = new Set();

      if (jsonData?.geonames?.geoname) {
        for (const geoName of jsonData.geonames.geoname) {
          geoNameSet.add(`${geoName.name}, ${geoName.countryCode}`);
        }
      }

      return {
        geonames: Array.from(geoNameSet) ?? [],
      };
    }),
});
