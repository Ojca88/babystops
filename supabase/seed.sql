-- Sample stops for local development. Not run in production.

insert into public.stops (name, description, lat, lng, address, amenities)
values
  (
    'Junction City Rest Area',
    'Clean family restroom with a changing table, plus a fenced grassy area to let toddlers run.',
    44.2196,
    -123.2038,
    'I-5 Northbound, Junction City, OR',
    array['diaper_change', 'family_restroom', 'rest_area', 'stroller_friendly']::amenity[]
  ),
  (
    'Centralia Factory Outlets',
    'Nursing room near the food court, plus a play area for older siblings.',
    46.7162,
    -122.9543,
    '1341 Lum Rd, Centralia, WA',
    array['nursing', 'food', 'playground', 'diaper_change']::amenity[]
  ),
  (
    'Chehalis River Park',
    'Quiet riverside park with picnic tables and a small playground — good for a stretch break.',
    46.6621,
    -122.9686,
    'Chehalis River Park, Chehalis, WA',
    array['playground', 'rest_area', 'stroller_friendly']::amenity[]
  );
