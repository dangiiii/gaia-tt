# Company location coordinates

`data/company_locations.json` is generated from company
`linkedin_headquarters` text using the GeoNames gazetteer distributed by the
`cities.json` package under CC BY 4.0.

GeoNames attribution: <https://www.geonames.org/>

Only country-consistent city matches are emitted. Companies without a verified
match remain represented by their country-level aggregate and are not assigned
fabricated coordinates.
