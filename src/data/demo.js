export const demoProperty = {
  id: 'demo-casa-temporada',
  name: 'Casa Sol do Vale',
  city: 'Campos do Jordao, SP',
  headline: 'Casa inteira para descansar com privacidade, conforto e check-in online.',
  description:
    'Ambientes claros, cozinha equipada, varanda ampla, Wi-Fi e espaco para reunir familia ou amigos com tranquilidade.',
  daily_rate: 480,
  cleaning_fee: 160,
  max_guests: 8,
  bedrooms: 3,
  bathrooms: 2,
  owner_whatsapp: '',
  rules: ['Check-in a partir das 14h', 'Check-out ate 11h', 'Nao fumar dentro da casa'],
  amenities: ['Wi-Fi', 'Cozinha equipada', 'Churrasqueira', 'Estacionamento', 'Roupas de cama'],
};

export const demoPhotos = [
  {
    id: 'photo-1',
    property_id: demoProperty.id,
    url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=85',
    alt: 'Fachada da casa de temporada',
    sort_order: 1,
  },
  {
    id: 'photo-2',
    property_id: demoProperty.id,
    url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85',
    alt: 'Sala de estar iluminada',
    sort_order: 2,
  },
  {
    id: 'photo-3',
    property_id: demoProperty.id,
    url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=85',
    alt: 'Cozinha e sala integradas',
    sort_order: 3,
  },
  {
    id: 'photo-4',
    property_id: demoProperty.id,
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85',
    alt: 'Varanda da casa',
    sort_order: 4,
  },
];

export const demoReservations = [
  {
    id: 'reserva-demo-1',
    property_id: demoProperty.id,
    guest_name: 'Reserva confirmada',
    check_in: '2026-06-12',
    check_out: '2026-06-16',
    guests: 4,
    total_amount: 2080,
    status: 'confirmed',
    payment_status: 'paid',
  },
  {
    id: 'reserva-demo-2',
    property_id: demoProperty.id,
    guest_name: 'Bloqueio de manutencao',
    check_in: '2026-06-24',
    check_out: '2026-06-27',
    guests: 1,
    total_amount: 0,
    status: 'blocked',
    payment_status: 'not_required',
  },
];
