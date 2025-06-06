import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

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
        geonames: z.array(z.record(z.any())).optional().default([]),
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

      const geoNameMap = new Map();

      if (jsonData?.geonames?.geoname) {
        for (const geoName of jsonData.geonames.geoname) {
          geoNameMap.set(`${geoName.name}, ${geoName.countryCode}`, geoName);
        }
      }

      const geonames =
        Array.from(geoNameMap).map((item) => ({ [item[0]]: item[1] })) ?? [];

      return {
        geonames,
      };
    }),
});
