/**
 * Central hotel configuration.
 * Change these values when deploying for a different hotel.
 */
export const HOTEL = {
  name: 'Maritim Hotel Ingolstadt',
  street: 'Am Congress Centrum 1',
  zip: '85049',
  city: 'Ingolstadt',
  country: 'Deutschland',
  phone: '+49 841 49050',
  email: 'info@maritim-ingolstadt.de',
  taxId: 'DE 123 456 789',
  iban: 'DE89 3704 0044 0532 0130 00',
  bic: 'COBADEFFXXX',
}

export const HOTEL_ADDRESS = `${HOTEL.street} · ${HOTEL.zip} ${HOTEL.city}`
export const HOTEL_FULL = `${HOTEL.name} · ${HOTEL_ADDRESS}`
