import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BedDouble,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileText,
  Home,
  ImagePlus,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  User,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { demoPhotos, demoProperties, demoProperty, demoReservations } from './data/demo';
import { hasSupabaseConfig, supabase } from './lib/supabase';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'glawcksilva8@gmail.com';
const superAdminEmail = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'glawcksilva55@gmail.com';
const commercialEmail = import.meta.env.VITE_COMMERCIAL_EMAIL || 'hospedex1@gmail.com';
const adminEmailAliases = (import.meta.env.VITE_ADMIN_EMAIL_ALIASES || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const legacyRoleMap = {
  admin: 'proprietario',
  client: 'hospede',
};
const localAdminPassword = import.meta.env.VITE_LOCAL_ADMIN_PASSWORD || '';
const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || localAdminPassword;
const canUsePasswordAdmin = Boolean(adminPassword);
const fallbackOwnerWhatsapp = import.meta.env.VITE_OWNER_WHATSAPP || '43998108328';
const fallbackOwnerEmail = import.meta.env.VITE_OWNER_EMAIL || adminEmail;
const paymentLabels = {
  pix: 'Pix',
  card: 'Cartão',
  transfer: 'Transferência',
  cash: 'Dinheiro',
  check: 'Cheque',
};

const roleLabels = {
  super_admin: 'Super Admin',
  proprietario: 'Proprietário',
  hospede: 'Hóspede',
  admin: 'Proprietário',
  client: 'Hóspede',
};

const licenseStatusLabels = {
  active: 'Ativa',
  expired: 'Vencida',
  suspended: 'Suspensa',
  trial: 'Teste',
};

const defaultInterestRates = [
  { installments: 1, rate: 0 },
  { installments: 2, rate: 3 },
  { installments: 3, rate: 5 },
  { installments: 4, rate: 7 },
];

const reservationStatusLabels = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  blocked: 'Bloqueado manualmente',
  cancelled: 'Cancelado',
  maintenance: 'Manutenção',
};

const emptyProperty = {
  name: '',
  city: '',
  headline: '',
  description: '',
  daily_rate: 0,
  cleaning_fee: 0,
  max_guests: 1,
  bedrooms: 1,
  bathrooms: 1,
  owner_whatsapp: fallbackOwnerWhatsapp,
  owner_email: fallbackOwnerEmail,
  maps_url: '',
  theme_color: '#2563eb',
  license_key: '',
  license_expires_at: '',
  license_active: true,
  rules: [],
  amenities: [],
};

function toDate(value) {
  return value ? parseISO(value) : null;
}

function dateKey(date) {
  return format(date, 'yyyy-MM-dd');
}

function getCalendarAvailability(reservations) {
  const availability = new Map();
  reservations
    .filter((reservation) => ['confirmed', 'blocked', 'maintenance'].includes(reservation.status))
    .forEach((reservation) => {
      const start = toDate(reservation.check_in);
      const end = addDays(toDate(reservation.check_out), -1);
      if (!start || !end || isBefore(end, start)) return;
      eachDayOfInterval({ start, end }).forEach((day) => {
        availability.set(dateKey(day), {
          label:
            reservation.status === 'confirmed'
              ? 'Reservado'
              : reservation.status === 'blocked'
                ? 'Bloqueado'
                : reservationStatusLabels[reservation.status] || 'Indisponível',
          reservation,
          status: reservation.status,
        });
      });
    });
  return availability;
}

function hasConflict(reservations, checkIn, checkOut) {
  if (!checkIn || !checkOut) return false;
  const selectedStart = toDate(checkIn);
  const selectedEnd = addDays(toDate(checkOut), -1);
  if (!selectedStart || !selectedEnd) return false;

  return reservations
    .filter((reservation) => ['confirmed', 'blocked', 'maintenance'].includes(reservation.status))
    .some((reservation) => {
      const reservedStart = toDate(reservation.check_in);
      const reservedEnd = addDays(toDate(reservation.check_out), -1);
      return (
        isWithinInterval(selectedStart, { start: reservedStart, end: reservedEnd }) ||
        isWithinInterval(selectedEnd, { start: reservedStart, end: reservedEnd }) ||
        isWithinInterval(reservedStart, { start: selectedStart, end: selectedEnd })
      );
    });
}

function buildCalendarDays(month) {
  const firstVisible = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const lastMonthDay = endOfMonth(month);
  return Array.from({ length: 42 }, (_, index) => addDays(firstVisible, index)).filter((day) =>
    isBefore(day, addDays(lastMonthDay, 14)),
  );
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsAppPhone(phone) {
  const digits = onlyDigits(phone);
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function normalizeHexColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#2563eb';
}

function normalizeExternalUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function readLocalData(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(`casa-do-ype:${key}`);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalData(key, value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`casa-do-ype:${key}`, JSON.stringify(value));
}

async function safeSupabaseQuery(query, timeoutMs = 12000) {
  let timerId;
  const timeout = new Promise((resolve) => {
    timerId = setTimeout(() => resolve({ data: null, error: new Error('Consulta inicial excedeu o tempo limite.') }), timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve(query).catch((error) => ({ data: null, error })),
      timeout,
    ]);
  } finally {
    clearTimeout(timerId);
  }
}

function mixHex(color, target, amount) {
  const source = normalizeHexColor(color).slice(1).match(/.{2}/g).map((part) => parseInt(part, 16));
  const goal = normalizeHexColor(target).slice(1).match(/.{2}/g).map((part) => parseInt(part, 16));
  const mixed = source.map((value, index) => Math.round(value + (goal[index] - value) * amount));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function buildThemeStyle(color) {
  const accent = normalizeHexColor(color);
  return {
    '--property-accent': accent,
    '--property-accent-light': mixHex(accent, '#ffffff', 0.38),
    '--property-accent-dark': mixHex(accent, '#020617', 0.34),
  };
}

function buildReservationMessage({ property, reservation, nights }) {
  return [
    `Nova solicitação de reserva - ${property.name}`,
    '',
    `Nome: ${reservation.guest_name}`,
    `Telefone: ${reservation.guest_phone}`,
    `Email: ${reservation.guest_email}`,
    reservation.guest_document ? `Documento: ${reservation.guest_document}` : null,
    `Check-in: ${reservation.check_in}`,
    `Check-out: ${reservation.check_out}`,
    `Noites: ${nights}`,
    `Hóspedes: ${reservation.guests}`,
    `Pagamento: ${paymentLabels[reservation.payment_method] || 'A combinar'}`,
    `Total estimado: ${currency.format(reservation.total_amount || 0)}`,
    reservation.payment_url ? `Link de pagamento: ${reservation.payment_url}` : null,
    reservation.notes ? `Observações: ${reservation.notes}` : null,
    '',
    `Código da reserva: ${reservation.id}`,
    'Aguardando confirmação do proprietário.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildWhatsAppUrl(phone, message) {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return '';
  return `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`;
}

function buildOwnerEmailUrl({ ownerEmail, property, reservation, nights }) {
  const email = String(ownerEmail || fallbackOwnerEmail || '').trim();
  if (!email) return '';
  const subject = `Nova solicitação de reserva - ${property.name}`;
  const body = buildReservationMessage({ property, reservation, nights });
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function buildGuestConfirmationMessage(property, reservation, paymentSettings) {
  const cardPaymentUrl = reservation.payment_url || paymentSettings?.card_payment_url;
  const paymentNoticeByMethod = {
    pix: [
      'Pagamento por Pix:',
      paymentSettings?.pix_receiver_name ? `Recebedor: ${paymentSettings.pix_receiver_name}` : null,
      paymentSettings?.pix_key_type ? `Tipo da chave: ${paymentSettings.pix_key_type}` : null,
      paymentSettings?.pix_key ? `Chave Pix: ${paymentSettings.pix_key}` : null,
      reservation.payment_url ? `Link de pagamento: ${reservation.payment_url}` : null,
      `Valor: ${currency.format(reservation.total_amount || 0)}`,
      paymentSettings?.payment_instructions || 'Envie o comprovante após o pagamento.',
    ],
    card: [
      'Pagamento por cartão:',
      reservation.installments ? `Parcelamento: ${reservation.installments}x` : null,
      reservation.interest_rate ? `Juros aplicado: ${reservation.interest_rate}%` : null,
      cardPaymentUrl ? `Link de pagamento: ${cardPaymentUrl}` : null,
      `Valor total: ${currency.format(reservation.total_amount || 0)}`,
      cardPaymentUrl ? null : 'O proprietário enviará o link de pagamento.',
    ],
    transfer: [
      'Transferência bancária:',
      paymentSettings?.bank_name ? `Banco: ${paymentSettings.bank_name}` : null,
      paymentSettings?.bank_agency ? `Agência: ${paymentSettings.bank_agency}` : null,
      paymentSettings?.bank_account ? `Conta: ${paymentSettings.bank_account}` : null,
      paymentSettings?.bank_account_type ? `Tipo de conta: ${paymentSettings.bank_account_type}` : null,
      paymentSettings?.bank_holder ? `Titular: ${paymentSettings.bank_holder}` : null,
      paymentSettings?.bank_document ? `CPF/CNPJ: ${paymentSettings.bank_document}` : null,
      `Valor: ${currency.format(reservation.total_amount || 0)}`,
      paymentSettings?.payment_instructions || 'Envie o comprovante após a transferência.',
    ],
  };
  const paymentNotice = (paymentNoticeByMethod[reservation.payment_method] || [
    `Forma de pagamento combinada: ${paymentLabels[reservation.payment_method] || 'a combinar'}.`,
  ])
    .filter(Boolean)
    .join('\n');

  return [
    `Olá, ${reservation.guest_name}.`,
    `Sua reserva em ${property.name} foi confirmada.`,
    `Check-in: ${reservation.check_in}`,
    `Check-out: ${reservation.check_out}`,
    `Hóspedes: ${reservation.guests}`,
    `Total estimado: ${currency.format(reservation.total_amount || 0)}`,
    paymentNotice,
  ].join('\n');
}

function buildMapsUrl(property) {
  const mapsUrl = normalizeExternalUrl(property.maps_url);
  if (mapsUrl) return mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.city)}`;
}

function isLicenseValid(property) {
  if (property.license_active === false) return false;
  if (!property.license_expires_at) return true;
  const expiresAt = toDate(property.license_expires_at);
  if (!expiresAt) return true;
  return !isBefore(addDays(expiresAt, 1), new Date());
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function parseAdminList(value) {
  return String(value || '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRole(role) {
  const normalized = String(role || '').toLowerCase();
  return legacyRoleMap[normalized] || normalized;
}

function isSuperAdminEmail(email) {
  return String(email || '').toLowerCase() === superAdminEmail.toLowerCase();
}

function getAuthRole(profile, email) {
  const normalizedEmail = String(email || '').toLowerCase();
  if (normalizedEmail === superAdminEmail.toLowerCase()) return 'super_admin';
  if (profile?.role) return normalizeRole(profile.role);
  if (isAdminEmail(email)) return 'proprietario';
  return 'hospede';
}

function roleHomePath(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'super_admin') return '/super-admin';
  if (normalizedRole === 'proprietario') return '/admin';
  return '/hospede';
}

function calculateCardInstallment(total, installments, interestRates) {
  const rule = interestRates.find((item) => Number(item.installments) === Number(installments));
  const rate = Number(rule?.rate || 0);
  const interest = total * (rate / 100);
  const finalTotal = total + interest;
  return {
    installments: Number(installments),
    rate,
    interest,
    finalTotal,
    installmentValue: Number(installments) ? finalTotal / Number(installments) : finalTotal,
  };
}

function getReservationNights(reservation) {
  if (!reservation?.check_in || !reservation?.check_out) return 0;
  return Math.max(0, differenceInCalendarDays(toDate(reservation.check_out), toDate(reservation.check_in)));
}

function getVoucherSummary(reservations) {
  const confirmedNights = reservations
    .filter((reservation) => reservation.status === 'confirmed')
    .reduce((sum, reservation) => sum + getReservationNights(reservation), 0);
  const generated = Math.floor(confirmedNights / 10);
  const used = reservations.filter((reservation) => reservation.voucher_used).length;
  return {
    confirmedNights,
    generated,
    used,
    available: Math.max(0, generated - used),
  };
}

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function generateLicenseKey(prefix = 'HOSPEDEX') {
  const random = crypto.randomUUID().split('-').slice(0, 3).join('').toUpperCase();
  return `${prefix}-${format(new Date(), 'yyyyMM')}-${random.slice(0, 12)}`;
}

function isLicenseExpired(license) {
  if (!license?.expires_at) return false;
  return isBefore(addDays(toDate(license.expires_at), 1), new Date());
}

function normalizeLicenseStatus(license) {
  if (!license) return 'expired';
  if (license.status === 'suspended' || license.status === 'trial') return license.status;
  return isLicenseExpired(license) ? 'expired' : license.status || 'active';
}

function isAdminEmail(email) {
  const normalized = String(email || '').toLowerCase();
  return normalized === adminEmail.toLowerCase() || adminEmailAliases.includes(normalized);
}

function isPrivilegedEmail(email) {
  return isSuperAdminEmail(email) || isAdminEmail(email);
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function MaterialIcon({ name, className = '', size = 20 }) {
  return (
    <span className={`material-symbols-rounded leading-none ${className}`} style={{ fontSize: size }} aria-hidden="true">
      {name}
    </span>
  );
}

function Button({ children, className = '', variant = 'primary', ...props }) {
  const variants = {
    primary: 'btn-primary-theme',
    secondary: 'btn-secondary-theme',
    ghost:
      'bg-white/85 text-ink shadow-[0_10px_24px_rgba(255,255,255,0.18)] backdrop-blur hover:bg-white',
    outline:
      'border border-blue-200 bg-gradient-to-r from-white to-blue-50 text-ink shadow-sm hover:border-blue-300 hover:from-blue-50 hover:to-white',
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-base text-ink shadow-sm transition placeholder:text-ink/40 sm:text-sm"
      {...props}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      className="min-h-24 rounded-md border border-ink/15 bg-white px-3 py-2 text-base text-ink shadow-sm transition placeholder:text-ink/40 sm:text-sm"
      {...props}
    />
  );
}

function SelectInput({ children, ...props }) {
  return (
    <select
      className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-base text-ink shadow-sm transition sm:text-sm"
      {...props}
    >
      {children}
    </select>
  );
}

export default function App() {
  const [properties, setProperties] = useState(() => readLocalData('properties', demoProperties));
  const [selectedPropertyId, setSelectedPropertyId] = useState(() => readLocalData('selectedPropertyId', demoProperty.id));
  const [photos, setPhotos] = useState(() => readLocalData('photos', demoPhotos));
  const [reservations, setReservations] = useState(() => readLocalData('reservations', demoReservations));
  const [cashMovements, setCashMovements] = useState(() => readLocalData('cashMovements', []));
  const [suggestions, setSuggestions] = useState(() => readLocalData('suggestions', []));
  const [adminLogs, setAdminLogs] = useState(() => readLocalData('adminLogs', []));
  const [interestRates, setInterestRates] = useState(() => readLocalData('interestRates', defaultInterestRates));
  const [profiles, setProfiles] = useState(() => readLocalData('profiles', []));
  const [licenses, setLicenses] = useState(() => readLocalData('licenses', []));
  const [licenseHistory, setLicenseHistory] = useState(() => readLocalData('licenseHistory', []));
  const [paymentSettings, setPaymentSettings] = useState(() => readLocalData('paymentSettings', []));
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);
  const [route, setRoute] = useState(() => (typeof window === 'undefined' ? '/' : window.location.pathname || '/'));
  const [month, setMonth] = useState(new Date());
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminSession, setAdminSession] = useState(null);
  const [authProfile, setAuthProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(!hasSupabaseConfig);
  const [authOpen, setAuthOpen] = useState(false);
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(false);
  const [clientPortalOpen, setClientPortalOpen] = useState(false);
  const [themeMode, setThemeMode] = useState(() => readLocalData('themeMode', 'light'));
  const [message, setMessage] = useState('');
  const [lastWhatsAppUrl, setLastWhatsAppUrl] = useState('');
  const [propertyTransitionKey, setPropertyTransitionKey] = useState(0);
  const [booking, setBooking] = useState({
    check_in: '',
    check_out: '',
    guests: 2,
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    guest_document: '',
    payment_method: 'pix',
    installments: 1,
    notes: '',
  });

  const property = properties.find((item) => item.id === selectedPropertyId) || properties[0] || demoProperty;
  const propertyLicense = useMemo(
    () =>
      licenses.find((license) => license.property_id === property.id) ||
      licenses.find((license) => license.owner_id && license.owner_id === property.owner_id) ||
      null,
    [licenses, property.id, property.owner_id],
  );
  const propertyPaymentSettings = useMemo(
    () =>
      paymentSettings.find((setting) => setting.property_id === property.id) ||
      paymentSettings.find((setting) => setting.owner_id && setting.owner_id === property.owner_id) ||
      null,
    [paymentSettings, property.id, property.owner_id],
  );
  const adminProperties = useMemo(() => {
    if (!authProfile) return properties;
    if (normalizeRole(authProfile.role) === 'super_admin') return properties;
    const email = String(authProfile.email || '').toLowerCase();
    const ownedProperties = properties.filter(
      (item) =>
        item.owner_id === authProfile.id ||
        String(item.owner_email || '').toLowerCase() === email ||
        (!item.owner_id && isAdminEmail(email)),
    );
    return ownedProperties.length ? ownedProperties : [];
  }, [authProfile, properties]);
  const adminProperty = adminProperties.find((item) => item.id === property.id) || adminProperties[0] || property;
  const adminPropertyPaymentSettings =
    paymentSettings.find((setting) => setting.property_id === adminProperty.id) ||
    paymentSettings.find((setting) => setting.owner_id && setting.owner_id === adminProperty.owner_id) ||
    null;
  const adminPropertyLicense =
    licenses.find((license) => license.property_id === adminProperty.id) ||
    licenses.find((license) => license.owner_id && license.owner_id === adminProperty.owner_id) ||
    null;
  const propertyPhotos = useMemo(
    () => photos.filter((photo) => photo.property_id === property.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [photos, property.id],
  );
  const propertyReservations = useMemo(
    () => reservations.filter((reservation) => reservation.property_id === property.id),
    [reservations, property.id],
  );
  const propertyCashMovements = useMemo(
    () => cashMovements.filter((movement) => movement.property_id === property.id),
    [cashMovements, property.id],
  );
  const adminPropertyPhotos = useMemo(
    () => photos.filter((photo) => photo.property_id === adminProperty.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [photos, adminProperty.id],
  );
  const adminPropertyReservations = useMemo(
    () => reservations.filter((reservation) => reservation.property_id === adminProperty.id),
    [reservations, adminProperty.id],
  );
  const adminPropertyCashMovements = useMemo(
    () => cashMovements.filter((movement) => movement.property_id === adminProperty.id),
    [cashMovements, adminProperty.id],
  );
  const adminFinancialSummary = useMemo(() => {
    const received = adminPropertyCashMovements
      .filter((movement) => movement.type === 'income' && movement.status === 'received')
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const receivable = adminPropertyReservations
      .filter((reservation) => ['pending', 'confirmed'].includes(reservation.status))
      .filter((reservation) => reservation.payment_status !== 'paid')
      .reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);
    return { received, receivable, forecast: received + receivable };
  }, [adminPropertyCashMovements, adminPropertyReservations]);
  const selectedPhotoData = propertyPhotos[selectedPhoto] || propertyPhotos[0] || demoPhotos[0];
  const heroPhoto = propertyPhotos[heroPhotoIndex] || selectedPhotoData;
  const calendarAvailability = useMemo(() => getCalendarAvailability(propertyReservations), [propertyReservations]);
  const nights = useMemo(() => {
    if (!booking.check_in || !booking.check_out) return 0;
    return Math.max(0, differenceInCalendarDays(toDate(booking.check_out), toDate(booking.check_in)));
  }, [booking.check_in, booking.check_out]);
  const subtotal = nights * Number(property.daily_rate || 0);
  const total = subtotal + (nights > 0 ? Number(property.cleaning_fee || 0) : 0);
  const cardQuote = useMemo(
    () => calculateCardInstallment(total, booking.installments, interestRates),
    [total, booking.installments, interestRates],
  );
  const finalBookingTotal = booking.payment_method === 'card' ? cardQuote.finalTotal : total;
  const reservationConflict = hasConflict(propertyReservations, booking.check_in, booking.check_out);
  const propertyLicenseStatus = normalizeLicenseStatus(propertyLicense);
  const licenseValid =
    isLicenseValid(property) && (!propertyLicense || !['expired', 'suspended'].includes(propertyLicenseStatus));
  const voucherSummary = useMemo(() => getVoucherSummary(propertyReservations), [propertyReservations]);
  const financialSummary = useMemo(() => {
    const received = propertyCashMovements
      .filter((movement) => movement.type === 'income' && movement.status === 'received')
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const receivable = propertyReservations
      .filter((reservation) => ['pending', 'confirmed'].includes(reservation.status))
      .filter((reservation) => reservation.payment_status !== 'paid')
      .reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);
    return { received, receivable, forecast: received + receivable };
  }, [propertyCashMovements, propertyReservations]);
  const canBook =
    nights > 0 &&
    !reservationConflict &&
    String(booking.guest_name).trim() &&
    String(booking.guest_email).trim() &&
    String(booking.guest_phone).trim() &&
    String(booking.guest_document).trim() &&
    String(booking.notes).trim() &&
    booking.payment_method &&
    Number(booking.guests) > 0 &&
    Number(booking.guests) <= property.max_guests &&
    licenseValid;
  const propertyThemeStyle = useMemo(() => buildThemeStyle(property.theme_color), [property.theme_color]);

  async function loadSupabaseData() {
    if (!hasSupabaseConfig) {
      return;
    }

    try {
      const [
        { data: propertyRows },
        { data: photoRows },
        { data: reservationRows },
        { data: movementRows },
        { data: interestRows },
        { data: profileRows },
        { data: licenseRows },
        { data: licenseHistoryRows },
        { data: paymentSettingRows },
      ] =
        await Promise.all([
          safeSupabaseQuery(supabase.from('properties').select('*').order('created_at')),
          safeSupabaseQuery(supabase.from('property_photos').select('*').order('sort_order')),
          safeSupabaseQuery(supabase.from('reservations').select('*').order('check_in')),
          safeSupabaseQuery(supabase.from('cash_movements').select('*').order('due_date', { ascending: false })),
          safeSupabaseQuery(supabase.from('interest_settings').select('*').eq('active', true).order('installments')),
          safeSupabaseQuery(supabase.from('profiles').select('*').order('created_at')),
          safeSupabaseQuery(supabase.from('licenses').select('*').order('expires_at', { ascending: true })),
          safeSupabaseQuery(supabase.from('license_history').select('*').order('created_at', { ascending: false })),
          safeSupabaseQuery(supabase.from('payment_settings').select('*').order('created_at')),
        ]);

      if (propertyRows?.length) {
        setProperties(propertyRows);
        setSelectedPropertyId(propertyRows[0].id);
      }
      if (photoRows?.length) setPhotos(photoRows);
      if (reservationRows?.length) setReservations(reservationRows);
      if (movementRows?.length) setCashMovements(movementRows);
      if (interestRows?.length) {
        setInterestRates(interestRows.map((item) => ({ installments: item.installments, rate: Number(item.rate || 0) })));
      }
      if (profileRows?.length) setProfiles(profileRows);
      if (licenseRows?.length) setLicenses(licenseRows);
      if (licenseHistoryRows?.length) setLicenseHistory(licenseHistoryRows);
      if (paymentSettingRows?.length) setPaymentSettings(paymentSettingRows);
    } catch {
      // Keep the public page visible even when optional admin data cannot be loaded.
    }
  }

  async function resolveAuthProfile(session) {
    if (!session?.user) {
      setAdminSession(null);
      setAuthProfile(null);
      setAdminUnlocked(false);
      setAuthChecked(true);
      return null;
    }

    let profile = {
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      phone: session.user.user_metadata?.phone || '',
      role: getAuthRole(null, session.user.email),
    };

    if (hasSupabaseConfig) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (data) {
        profile = { ...profile, ...data, role: getAuthRole(data, session.user.email) };
      } else {
        await supabase.from('profiles').upsert({
          id: session.user.id,
          email: session.user.email,
          role: profile.role,
          full_name: profile.full_name,
          phone: profile.phone,
        });
      }
    }

    setAdminSession(session);
    setAuthProfile(profile);
    setAdminUnlocked(['proprietario', 'super_admin'].includes(normalizeRole(profile.role)));
    setAuthChecked(true);
    return profile;
  }

  useEffect(() => {
    loadSupabaseData();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPopState = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigateTo(path) {
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setRoute(path);
  }

  useEffect(() => {
    setSelectedPhoto(0);
    setMessage('');
    setLastWhatsAppUrl('');
    setPropertyTransitionKey((current) => current + 1);
      setBooking((current) => ({
      ...current,
      check_in: '',
      check_out: '',
    }));
    setHeroPhotoIndex(0);
  }, [property.id]);

  useEffect(() => {
    if (!hasSupabaseConfig) return undefined;

    supabase.auth.getSession().then(async ({ data }) => {
      const profile = await resolveAuthProfile(data.session);
      if (['super_admin', 'proprietario'].includes(profile?.role)) loadSupabaseData();
    });

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecoveryOpen(true);
      const profile = await resolveAuthProfile(session);
      if (['super_admin', 'proprietario'].includes(profile?.role)) loadSupabaseData();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('properties', properties);
  }, [properties]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('selectedPropertyId', selectedPropertyId);
  }, [selectedPropertyId]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('photos', photos);
  }, [photos]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('reservations', reservations);
  }, [reservations]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('cashMovements', cashMovements);
  }, [cashMovements]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('suggestions', suggestions);
  }, [suggestions]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('adminLogs', adminLogs);
  }, [adminLogs]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('interestRates', interestRates);
  }, [interestRates]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('profiles', profiles);
  }, [profiles]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('licenses', licenses);
  }, [licenses]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('licenseHistory', licenseHistory);
  }, [licenseHistory]);

  useEffect(() => {
    if (hasSupabaseConfig) return;
    writeLocalData('paymentSettings', paymentSettings);
  }, [paymentSettings]);

  useEffect(() => {
    writeLocalData('themeMode', themeMode);
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
  }, [themeMode]);

  useEffect(() => {
    if (!authChecked) return;
    const protectedRoutes = ['/super-admin', '/admin', '/hospede'];
    if (protectedRoutes.includes(route) && !authProfile) {
      navigateTo('/login');
      return;
    }
    if (route === '/super-admin' && normalizeRole(authProfile?.role) !== 'super_admin') {
      navigateTo(roleHomePath(authProfile?.role));
      return;
    }
    if (route === '/admin' && !['proprietario', 'super_admin'].includes(normalizeRole(authProfile?.role))) {
      navigateTo(roleHomePath(authProfile?.role));
      return;
    }
    if (route === '/hospede' && !['hospede', 'super_admin'].includes(normalizeRole(authProfile?.role))) {
      navigateTo(roleHomePath(authProfile?.role));
    }
  }, [route, authProfile, authChecked]);

  useEffect(() => {
    if (!authProfile) return;
    if (route === '/admin' && ['proprietario', 'super_admin'].includes(normalizeRole(authProfile.role))) {
      setAdminOpen(true);
    }
    if (route === '/hospede' && ['hospede', 'super_admin'].includes(normalizeRole(authProfile.role))) {
      setClientPortalOpen(true);
    }
  }, [route, authProfile]);

  useEffect(() => {
    if (normalizeRole(authProfile?.role) !== 'hospede') return;
    setBooking((current) => ({
      ...current,
      guest_name: current.guest_name || authProfile.full_name || '',
      guest_email: authProfile.email || current.guest_email,
      guest_phone: current.guest_phone || authProfile.phone || '',
    }));
  }, [authProfile]);

  useEffect(() => {
    if (route !== '/admin' || !authProfile || normalizeRole(authProfile.role) === 'super_admin') return;
    if (!adminProperties.length) return;
    if (!adminProperties.some((item) => item.id === selectedPropertyId)) {
      setSelectedPropertyId(adminProperties[0].id);
    }
  }, [route, authProfile, adminProperties, selectedPropertyId]);

  useEffect(() => {
    if (propertyPhotos.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setHeroPhotoIndex((current) => (current + 1) % propertyPhotos.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [propertyPhotos.length, property.id]);

  async function createReservation(event) {
    event.preventDefault();
    if (!canBook) return;

    const reservation = {
      property_id: property.id,
      guest_user_id: normalizeRole(authProfile?.role) === 'hospede' ? authProfile.id : null,
      ...booking,
      guests: Number(booking.guests),
      installments: Number(booking.payment_method === 'card' ? booking.installments : 1),
      interest_rate: booking.payment_method === 'card' ? cardQuote.rate : 0,
      interest_amount: booking.payment_method === 'card' ? cardQuote.interest : 0,
      total_amount: finalBookingTotal,
      status: 'pending',
      payment_status: 'pending',
      payment_method: booking.payment_method,
    };

    let createdReservation = reservation;

    if (hasSupabaseConfig) {
      const { data, error } = await supabase.from('reservations').insert(reservation).select().single();
      if (error) {
        setMessage('Não foi possível criar a reserva agora. Confira os dados e tente novamente.');
        return;
      }
      createdReservation = data;
      setReservations((current) => [...current, data]);
    } else {
      const localReservation = { ...reservation, id: crypto.randomUUID() };
      createdReservation = localReservation;
      setReservations((current) => [...current, localReservation]);
    }

    const ownerEmailUrl = buildOwnerEmailUrl({
      ownerEmail: property.owner_email,
      property,
      reservation: createdReservation,
      nights,
    });
    setLastWhatsAppUrl(ownerEmailUrl);
    if (ownerEmailUrl) window.open(ownerEmailUrl, '_blank', 'noopener,noreferrer');

    setMessage('Solicitação enviada. O e-mail do proprietário foi aberto com os dados da reserva para confirmação.');
    setBooking({
      check_in: '',
      check_out: '',
      guests: 2,
      guest_name: normalizeRole(authProfile?.role) === 'hospede' ? authProfile.full_name || '' : '',
      guest_email: normalizeRole(authProfile?.role) === 'hospede' ? authProfile.email || '' : '',
      guest_phone: normalizeRole(authProfile?.role) === 'hospede' ? authProfile.phone || '' : '',
      guest_document: '',
      payment_method: 'pix',
      installments: 1,
      notes: '',
    });
  }

  async function updateClientProfile(updates) {
    if (!authProfile?.id) return;
    const nextProfile = { ...authProfile, ...updates };
    setAuthProfile(nextProfile);
    if (hasSupabaseConfig) {
      await supabase
        .from('profiles')
        .update({
          full_name: nextProfile.full_name,
          phone: nextProfile.phone,
        })
        .eq('id', authProfile.id);
      await supabase.auth.updateUser({
        data: {
          full_name: nextProfile.full_name,
          phone: nextProfile.phone,
        },
      });
    }
  }

  async function createPaymentLink(reservation) {
    if (!hasSupabaseConfig || !['pix', 'card'].includes(reservation.payment_method)) {
      return reservation;
    }

    const { data, error } = await supabase.functions.invoke('create-payment-preference', {
      body: {
        reservationId: reservation.id,
        propertyName: property.name,
        payerEmail: reservation.guest_email,
        amount: Number(reservation.total_amount || 0),
      },
    });

    if (error || !data?.paymentUrl) return reservation;
    return { ...reservation, payment_url: data.paymentUrl };
  }

  async function saveProperty(updated) {
    const normalized = {
      ...updated,
      maps_url: normalizeExternalUrl(updated.maps_url),
    };

    setProperties((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
    if (hasSupabaseConfig) {
      await supabase.from('properties').update(normalized).eq('id', normalized.id);
    }
    setMessage('Informações da casa atualizadas.');
  }

  function selectProperty(propertyId) {
    if (propertyId === property.id) return;
    setSelectedPropertyId(propertyId);
  }

  async function addProperty(propertyDraft) {
    const propertyPayload = {
      ...emptyProperty,
      ...propertyDraft,
      id: crypto.randomUUID(),
      owner_id: propertyDraft.owner_id || (authProfile?.role === 'proprietario' ? authProfile.id : null),
      daily_rate: Number(propertyDraft.daily_rate || 0),
      cleaning_fee: Number(propertyDraft.cleaning_fee || 0),
      max_guests: Number(propertyDraft.max_guests || 1),
      bedrooms: Number(propertyDraft.bedrooms || 1),
      bathrooms: Number(propertyDraft.bathrooms || 1),
      owner_whatsapp: propertyDraft.owner_whatsapp || fallbackOwnerWhatsapp,
      owner_email: propertyDraft.owner_email || fallbackOwnerEmail,
      maps_url: normalizeExternalUrl(propertyDraft.maps_url),
      license_key: propertyDraft.license_key || '',
      license_expires_at: propertyDraft.license_expires_at || '',
      license_active: propertyDraft.license_active !== false,
      amenities: Array.isArray(propertyDraft.amenities) ? propertyDraft.amenities : [],
      rules: Array.isArray(propertyDraft.rules) ? propertyDraft.rules : [],
    };

    let createdProperty = propertyPayload;
    if (hasSupabaseConfig) {
      const { id, ...insertable } = propertyPayload;
      const { data, error } = await supabase.from('properties').insert(insertable).select().single();
      if (error) {
        setMessage('Não foi possível cadastrar a casa agora.');
        return;
      }
      createdProperty = data;
    }

    setProperties((current) => [...current, createdProperty]);
    setSelectedPropertyId(createdProperty.id);
    setMessage('Casa cadastrada. Agora adicione fotos e ajuste os dados.');
  }

  async function deleteProperty(propertyId) {
    if (properties.length <= 1) {
      setMessage('Mantenha pelo menos uma casa cadastrada.');
      return;
    }
    const nextProperties = properties.filter((item) => item.id !== propertyId);
    setProperties(nextProperties);
    setPhotos((current) => current.filter((photo) => photo.property_id !== propertyId));
    setReservations((current) => current.filter((reservation) => reservation.property_id !== propertyId));
    setCashMovements((current) => current.filter((movement) => movement.property_id !== propertyId));
    if (selectedPropertyId === propertyId) setSelectedPropertyId(nextProperties[0]?.id);
    if (hasSupabaseConfig) {
      await supabase.from('properties').delete().eq('id', propertyId);
    }
    await addAdminLog('property_deleted', { property_id: propertyId });
    setMessage('Casa excluída.');
  }

  async function addPhoto(photo) {
    const nextPhoto = {
      id: crypto.randomUUID(),
      property_id: property.id,
      sort_order: propertyPhotos.length + 1,
      ...photo,
    };
    setPhotos((current) => [...current, nextPhoto]);
    if (hasSupabaseConfig) {
      const { id, ...insertable } = nextPhoto;
      await supabase.from('property_photos').insert(insertable);
    }
    setMessage('Foto adicionada a galeria.');
  }

  async function deletePhoto(photoId) {
    const targetPhoto = photos.find((photo) => photo.id === photoId);
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    if (selectedPhoto > 0) setSelectedPhoto((current) => Math.max(0, current - 1));
    if (hasSupabaseConfig) {
      if (targetPhoto?.storage_path) {
        await supabase.storage.from('property-photos').remove([targetPhoto.storage_path]);
      }
      await supabase.from('property_photos').delete().eq('id', photoId);
    }
    setMessage('Foto removida da galeria.');
  }

  async function reorderPhoto(photoId, direction) {
    const ordered = [...propertyPhotos];
    const index = ordered.findIndex((photo) => photo.id === photoId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
    const updated = ordered.map((photo, itemIndex) => ({ ...photo, sort_order: itemIndex + 1, is_primary: itemIndex === 0 }));
    setPhotos((current) => current.map((photo) => updated.find((item) => item.id === photo.id) || photo));
    if (hasSupabaseConfig) {
      await Promise.all(
        updated.map((photo) =>
          supabase
            .from('property_photos')
            .update({ sort_order: photo.sort_order, is_primary: photo.is_primary })
            .eq('id', photo.id),
        ),
      );
    }
  }

  async function createManualReservation(reservationDraft) {
    const reservation = {
      property_id: property.id,
      guest_name: reservationDraft.guest_name || 'Reserva manual',
      guest_email: reservationDraft.guest_email || adminEmail,
      guest_phone: reservationDraft.guest_phone || '',
      guest_document: reservationDraft.guest_document || '',
      guests: Number(reservationDraft.guests || 1),
      check_in: reservationDraft.check_in,
      check_out: reservationDraft.check_out,
      total_amount: Number(reservationDraft.total_amount || 0),
      status: reservationDraft.status,
      payment_status: reservationDraft.status === 'blocked' || reservationDraft.status === 'maintenance' ? 'not_required' : 'pending',
      payment_method: reservationDraft.payment_method || 'cash',
      notes: reservationDraft.notes || '',
      source: 'manual',
    };
    if (hasConflict(propertyReservations, reservation.check_in, reservation.check_out)) {
      setMessage('Não foi possível criar: as datas conflitam com outra reserva ou bloqueio.');
      return false;
    }
    let created = { ...reservation, id: crypto.randomUUID() };
    if (hasSupabaseConfig) {
      const { data, error } = await supabase.from('reservations').insert(reservation).select().single();
      if (error) {
        setMessage('Não foi possível criar a reserva manual agora.');
        return false;
      }
      created = data;
    }
    setReservations((current) => [...current, created]);
    await addAdminLog('manual_reservation_created', { reservation_id: created.id, status: created.status });
    setMessage('Reserva manual criada e calendário atualizado.');
    return true;
  }

  async function updateReservationStatus(id, status) {
    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === id
          ? {
              ...reservation,
              status,
            }
          : reservation,
      ),
    );

    if (hasSupabaseConfig) {
      const updatePayload = { status };

      await supabase
        .from('reservations')
        .update(updatePayload)
        .eq('id', id);
    }
  }

  async function registerPayment(reservation, paymentStatus = 'paid') {
    const paidAt = new Date().toISOString();
    const movement = {
      property_id: reservation.property_id,
      reservation_id: reservation.id,
      type: 'income',
      status: paymentStatus === 'paid' ? 'received' : 'expected',
      payment_method: reservation.payment_method || 'cash',
      amount: Number(reservation.total_amount || 0),
      due_date: format(new Date(), 'yyyy-MM-dd'),
      paid_at: paymentStatus === 'paid' ? paidAt : null,
      description: `Reserva ${reservation.guest_name}`,
    };

    setReservations((current) =>
      current.map((item) =>
        item.id === reservation.id
          ? {
              ...item,
              payment_status: paymentStatus,
            }
          : item,
      ),
    );
    setCashMovements((current) => [{ ...movement, id: crypto.randomUUID() }, ...current]);

    if (hasSupabaseConfig) {
      await supabase.from('reservations').update({ payment_status: paymentStatus }).eq('id', reservation.id);
      await supabase.from('cash_movements').insert(movement);
    }
  }

  async function updateReservationDetails(id, updates) {
    const normalized = {
      ...updates,
      guests: updates.guests !== undefined ? Number(updates.guests || 1) : undefined,
      total_amount: updates.total_amount !== undefined ? Number(updates.total_amount || 0) : undefined,
    };
    Object.keys(normalized).forEach((key) => normalized[key] === undefined && delete normalized[key]);
    setReservations((current) =>
      current.map((reservation) => (reservation.id === id ? { ...reservation, ...normalized } : reservation)),
    );
    if (hasSupabaseConfig) {
      await supabase.from('reservations').update(normalized).eq('id', id);
    }
    await addAdminLog('reservation_updated', { reservation_id: id, updates: normalized });
    setMessage('Reserva atualizada.');
  }

  async function saveInterestRates(nextRates) {
    const normalizedRates = nextRates.map((item) => ({
      installments: Number(item.installments),
      rate: Number(item.rate || 0),
    }));
    setInterestRates(normalizedRates);
    if (hasSupabaseConfig) {
      await Promise.all(
        normalizedRates.map((item) =>
          supabase
            .from('interest_settings')
            .upsert({ installments: item.installments, rate: item.rate, active: true }, { onConflict: 'installments' }),
        ),
      );
    }
    await addAdminLog('interest_settings_updated', { rates: normalizedRates });
    setMessage('Configuração de juros atualizada.');
  }

  async function savePaymentSettings(nextSettings) {
    const payload = {
      ...nextSettings,
      property_id: property.id,
      owner_id: property.owner_id || (authProfile?.role === 'proprietario' ? authProfile.id : null),
      max_installments: Number(nextSettings.max_installments || 1),
    };
    let saved = { ...payload, id: payload.id || crypto.randomUUID() };
    if (hasSupabaseConfig) {
      const { data, error } = await supabase
        .from('payment_settings')
        .upsert(payload, { onConflict: 'property_id' })
        .select()
        .single();
      if (error) {
        setMessage('Não foi possível salvar as configurações financeiras.');
        return;
      }
      saved = data;
    }
    setPaymentSettings((current) => {
      const exists = current.some((item) => item.property_id === property.id);
      return exists ? current.map((item) => (item.property_id === property.id ? saved : item)) : [...current, saved];
    });
    await addAdminLog('payment_settings_updated', { property_id: property.id });
    setMessage('Configurações financeiras salvas.');
  }

  async function addAdminLog(action, details = {}) {
    const log = {
      id: crypto.randomUUID(),
      action,
      details,
      actor_email: authProfile?.email || adminEmail,
      created_at: new Date().toISOString(),
    };
    setAdminLogs((current) => [log, ...current]);
    if (hasSupabaseConfig) {
      const { id, ...insertable } = log;
      await supabase.from('admin_logs').insert(insertable);
    }
  }

  async function submitSuggestion(suggestion) {
    const payload = {
      ...suggestion,
      id: crypto.randomUUID(),
      property_id: property.id,
      user_id: authProfile?.id || null,
      user_email: authProfile?.email || suggestion.email || '',
      status: 'new',
      created_at: new Date().toISOString(),
    };
    setSuggestions((current) => [payload, ...current]);
    if (hasSupabaseConfig) {
      const { id, ...insertable } = payload;
      const { error: insertError } = await supabase.from('suggestions').insert(insertable);
      if (insertError) {
        setSuggestions((current) => current.filter((item) => item.id !== id));
        throw insertError;
      }
      const { error: emailError } = await supabase.functions.invoke('send-suggestion-email', {
        body: {
          name: payload.name,
          email: payload.user_email,
          message: payload.message,
          to: commercialEmail,
          propertyName: property.name,
        },
      });
      if (emailError) throw emailError;
    }
    const emailUrl = `mailto:${encodeURIComponent(commercialEmail)}?subject=${encodeURIComponent(
      `Sugestão para ${property.name}`,
    )}&body=${encodeURIComponent(`${payload.name || ''}\n${payload.user_email}\n\n${payload.message}`)}`;
    if (!hasSupabaseConfig) window.open(emailUrl, '_blank', 'noopener,noreferrer');
    setMessage('Sugestão enviada. Obrigado por ajudar a melhorar o site.');
  }

  async function signOut() {
    if (hasSupabaseConfig) await supabase.auth.signOut();
    setAdminSession(null);
    setAuthProfile(null);
    setAdminUnlocked(false);
    setClientPortalOpen(false);
    navigateTo('/');
  }

  if (route === '/login') {
    return (
      <div className="min-h-screen bg-[#f4f8ff] text-ink" style={propertyThemeStyle}>
        <AuthModal
          onClose={() => navigateTo('/')}
          onAuthenticated={(profile) => {
            setAuthProfile(profile);
            setAdminUnlocked(['proprietario', 'super_admin'].includes(normalizeRole(profile.role)));
            navigateTo(roleHomePath(profile.role));
          }}
          resolveAuthProfile={resolveAuthProfile}
        />
      </div>
    );
  }

  if (route === '/super-admin') {
    if (!authChecked) {
      return <div className="grid min-h-screen place-items-center bg-[#f4f8ff] font-bold text-ink">Validando acesso...</div>;
    }
    if (normalizeRole(authProfile?.role) !== 'super_admin') {
      return (
        <AccessDenied
          title="Acesso restrito"
          text="A área de Super Admin é privada e exige permissão super_admin."
          onLogin={() => navigateTo('/login')}
          onHome={() => navigateTo('/')}
        />
      );
    }
    return (
      <SuperAdminDashboard
        profiles={profiles}
        properties={properties}
        reservations={reservations}
        cashMovements={cashMovements}
        licenses={licenses}
        setLicenses={setLicenses}
        licenseHistory={licenseHistory}
        setLicenseHistory={setLicenseHistory}
        setProfiles={setProfiles}
        setProperties={setProperties}
        authProfile={authProfile}
        onSignOut={signOut}
        onHome={() => navigateTo('/')}
        addAdminLog={addAdminLog}
      />
    );
  }

  return (
    <div
      className={
        themeMode === 'dark'
          ? 'dark min-h-screen bg-slate-950 text-white'
          : 'min-h-screen bg-[#f4f8ff] text-ink'
      }
      style={propertyThemeStyle}
    >
      <header className="sticky top-0 z-30 border-b border-blue-100/80 bg-white/95 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex items-center gap-3 font-bold text-ink dark:text-white">
            <span className="grid h-10 w-10 place-items-center rounded-md text-white" style={{ background: 'var(--property-accent)' }}>
              <DoorOpen size={20} />
            </span>
            <span>{property.name}</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-bold text-ink/75 md:flex dark:text-white/75">
            <a className="transition hover:text-ink dark:hover:text-white" href="#fotos">Fotos</a>
            <a className="transition hover:text-ink dark:hover:text-white" href="#calendario">Calendário</a>
            <a className="transition hover:text-ink dark:hover:text-white" href="#reserva">Reservar</a>
            <a className="transition hover:text-ink dark:hover:text-white" href="#sugestoes">Sugestões</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
              aria-label="Alternar tema"
              className="px-3"
            >
              {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            {normalizeRole(authProfile?.role) === 'hospede' ? (
              <Button variant="outline" onClick={() => navigateTo('/hospede')}>
                <MaterialIcon name="account_circle" size={18} />
                Portal
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => {
                if (normalizeRole(authProfile?.role) === 'super_admin') {
                  navigateTo('/super-admin');
                } else if (normalizeRole(authProfile?.role) === 'proprietario' || adminUnlocked) {
                  navigateTo('/admin');
                } else {
                  navigateTo('/login');
                }
              }}
              aria-label="Abrir administracao"
              className="px-3"
            >
              <MaterialIcon name="person" size={18} />
            </Button>
          </div>
        </div>
      </header>

      <main id="inicio">
        <section className="relative overflow-hidden bg-ink text-white">
          <img
            key={`hero-${property.id}-${heroPhoto?.id || 'photo'}`}
            className="property-fade absolute inset-0 h-full w-full object-cover opacity-70"
            src={heroPhoto?.url}
            alt={heroPhoto?.alt || 'Foto da casa'}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/45 to-transparent" />
          <div className="relative mx-auto grid min-h-[620px] max-w-7xl content-end px-4 pb-12 pt-28 sm:px-6 lg:px-8">
            <div key={`content-${property.id}-${propertyTransitionKey}`} className="property-panel max-w-2xl">
              <a
                className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/14 px-3 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
                href={buildMapsUrl(property)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir ${property.city} no Google Maps`}
              >
                <MapPin size={16} />
                {property.city}
              </a>
              <h1 className="text-4xl font-black leading-tight sm:text-6xl">{property.name}</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/90">{property.headline}</p>
              {properties.length > 1 ? (
                <div className="mt-5 max-w-full overflow-x-auto rounded-full bg-white/12 p-1.5 backdrop-blur-md">
                  <div className="flex min-w-max gap-1.5">
                    {properties.map((item) => (
                      <button
                        key={item.id}
                        className={`relative rounded-full px-3.5 py-2 text-xs font-bold transition duration-200 ${
                          item.id === property.id
                            ? 'bg-white text-ink shadow-[0_10px_24px_rgba(15,23,42,0.2)]'
                            : 'text-white/85 hover:bg-white/14 hover:text-white'
                        }`}
                        onClick={() => selectProperty(item.id)}
                      >
                        <span className="block max-w-32 truncate">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-7 flex flex-wrap gap-3">
                <Button onClick={() => scrollToSection('reserva')}>
                  <CalendarDays size={18} />
                  Ver disponibilidade
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => scrollToSection('fotos')}
                >
                  Ver fotos
                </Button>
              </div>
              {propertyPhotos.length > 1 ? (
                <div className="mt-8 flex items-center gap-3">
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
                    onClick={() => setHeroPhotoIndex((current) => (current - 1 + propertyPhotos.length) % propertyPhotos.length)}
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex gap-2">
                    {propertyPhotos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        className={`h-2.5 rounded-full transition ${index === heroPhotoIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/45'}`}
                        onClick={() => setHeroPhotoIndex(index)}
                        aria-label={`Mostrar foto ${index + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
                    onClick={() => setHeroPhotoIndex((current) => (current + 1) % propertyPhotos.length)}
                    aria-label="Próxima foto"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="border-b border-ink/10 bg-white dark:border-white/10 dark:bg-slate-900">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <InfoStat icon={BedDouble} label="Quartos" value={property.bedrooms} />
            <InfoStat icon={DoorOpen} label="Banheiros" value={property.bathrooms} />
            <InfoStat icon={Users} label="Hóspedes" value={`até ${property.max_guests}`} />
            <InfoStat icon={CreditCard} label="Diária" value={currency.format(property.daily_rate)} />
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8 dark:text-white">
          <div>
            <p className="text-base leading-8 text-ink/75 dark:text-white/75">{property.description}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {property.amenities?.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md bg-white px-4 py-3 shadow-sm dark:bg-slate-900 dark:text-white dark:ring-1 dark:ring-white/10">
                  <Check className="text-leaf" size={18} />
                  <span className="font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <aside className="rounded-md border border-ink/10 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-slate-900 dark:text-white">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 text-leaf" />
              <div>
                <h2 className="text-xl font-black">Reserva segura</h2>
                <p className="mt-2 text-sm leading-6 text-ink/70 dark:text-white/70">
                  {hasSupabaseConfig
                    ? 'Os dados são enviados ao Supabase com políticas de segurança. Pagamentos reais devem ser conectados por um provedor oficial.'
                    : 'A solicitação abre um e-mail para o proprietário com os dados da reserva. Para banco de dados real, conecte o Supabase.'}
                </p>
              </div>
            </div>
          </aside>
        </section>

        {property.rules?.length ? (
          <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 dark:text-white">
            <div className="rounded-md bg-white p-5 shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-white/10">
              <h2 className="text-2xl font-black">Condições da locação</h2>
              <div className="mt-4 grid gap-3">
                {property.rules.map((rule) => (
                  <div key={rule} className="flex items-start gap-3 text-sm leading-6 text-ink/75 dark:text-white/75">
                    <ShieldCheck className="mt-0.5 shrink-0 text-leaf" size={18} />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section id="fotos" className="bg-mist py-14 dark:bg-slate-900 dark:text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black">Fotos da casa</h2>
                <p className="mt-2 text-ink/70 dark:text-white/70">A galeria atualiza quando você adiciona novas fotos.</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <img
                className="h-[360px] w-full rounded-md object-cover shadow-soft sm:h-[540px]"
                src={selectedPhotoData?.url}
                alt={selectedPhotoData?.alt || 'Foto selecionada'}
              />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                {propertyPhotos.slice(0, 4).map((photo, index) => (
                  <button
                    key={photo.id}
                    className={`h-40 overflow-hidden rounded-md border-2 bg-white ${
                      selectedPhoto === index ? 'border-coral' : 'border-transparent'
                    }`}
                    onClick={() => setSelectedPhoto(index)}
                  >
                    <img className="h-full w-full object-cover" src={photo.url} alt={photo.alt} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="calendario" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 dark:text-white">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-black">Disponibilidade</h2>
              <p className="mt-2 text-ink/70 dark:text-white/70">Datas em vermelho ja estao reservadas ou bloqueadas.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMonth(addDays(startOfMonth(month), -1))}>
                Anterior
              </Button>
              <Button variant="outline" onClick={() => setMonth(addDays(endOfMonth(month), 1))}>
                Proximo
              </Button>
            </div>
          </div>
          <CalendarGrid availability={calendarAvailability} month={month} />
        </section>

        <section id="reserva" className="bg-white py-14 text-ink">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
            <form className="grid gap-5" onSubmit={createReservation}>
              <div>
                <h2 className="text-3xl font-black">Solicitar reserva</h2>
                <p className="mt-2 text-ink/70">
                  Informe os dados para check-in, check-out e conferência da reserva.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Check-in">
                  <TextInput
                    type="date"
                    value={booking.check_in}
                    onChange={(event) => setBooking({ ...booking, check_in: event.target.value })}
                    onInput={(event) => setBooking({ ...booking, check_in: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Check-out">
                  <TextInput
                    type="date"
                    value={booking.check_out}
                    onChange={(event) => setBooking({ ...booking, check_out: event.target.value })}
                    onInput={(event) => setBooking({ ...booking, check_out: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Hóspedes">
                  <TextInput
                    type="number"
                    min="1"
                    max={property.max_guests}
                    value={booking.guests}
                    onChange={(event) => setBooking({ ...booking, guests: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Nome completo">
                  <TextInput
                    value={booking.guest_name}
                    onChange={(event) => setBooking({ ...booking, guest_name: event.target.value })}
                    placeholder="Seu nome"
                    required
                  />
                </Field>
                <Field label="E-mail">
                  <TextInput
                    type="email"
                    value={booking.guest_email}
                    onChange={(event) => setBooking({ ...booking, guest_email: event.target.value })}
                    placeholder="seu@email.com"
                    required
                  />
                </Field>
                <Field label="Telefone">
                  <TextInput
                    value={booking.guest_phone}
                    onChange={(event) => setBooking({ ...booking, guest_phone: event.target.value })}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </Field>
                <Field label="Documento">
                  <TextInput
                    value={booking.guest_document}
                    onChange={(event) => setBooking({ ...booking, guest_document: event.target.value })}
                    placeholder="CPF ou passaporte"
                    required
                  />
                </Field>
                <Field label="Forma de pagamento">
                  <SelectInput
                    value={booking.payment_method}
                    onChange={(event) => setBooking({ ...booking, payment_method: event.target.value, installments: 1 })}
                    required
                  >
                    <option value="pix">Pix</option>
                    <option value="card">Cartão</option>
                    <option value="transfer">Transferência</option>
                    <option value="cash">Dinheiro</option>
                    <option value="check">Cheque</option>
                  </SelectInput>
                </Field>
                {booking.payment_method === 'card' ? (
                  <Field label="Parcelas">
                    <SelectInput
                      value={booking.installments}
                      onChange={(event) => setBooking({ ...booking, installments: Number(event.target.value) })}
                    >
                      {interestRates.map((item) => (
                        <option key={item.installments} value={item.installments}>
                          {item.installments}x {Number(item.rate) ? `com ${item.rate}% de juros` : 'sem juros'}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                ) : null}
              </div>
              {booking.payment_method === 'card' ? (
                <div className="grid gap-3 rounded-md border border-ink/10 bg-[#f4f8ff] p-4 text-sm text-ink shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink/65">Valor original</span>
                    <strong>{currency.format(total)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink/65">Juros aplicados ({cardQuote.rate}%)</span>
                    <strong>{currency.format(cardQuote.interest)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3 text-base">
                    <span className="font-black">Total no cartão</span>
                    <strong>{currency.format(cardQuote.finalTotal)}</strong>
                  </div>
                  <p className="font-semibold text-ink/65">
                    {cardQuote.installments}x de {currency.format(cardQuote.installmentValue)}
                  </p>
                </div>
              ) : null}
              <Field label="Observações">
                <TextArea
                  value={booking.notes}
                  onChange={(event) => setBooking({ ...booking, notes: event.target.value })}
                  placeholder="Horário aproximado de chegada, dúvidas ou pedidos especiais"
                  required
                />
              </Field>
              {reservationConflict ? (
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  Essas datas conflitam com uma reserva existente.
                </p>
              ) : null}
              {!licenseValid ? (
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  As reservas desta casa estão pausadas porque a licença mensal está vencida ou inativa.
                </p>
              ) : null}
              <Button className="w-full sm:w-fit" type="submit" disabled={!canBook}>
                <Mail size={18} />
                Enviar solicitacao
              </Button>
            </form>

            <aside className="h-fit rounded-md border border-ink/10 bg-[#f4f8ff] p-5 text-ink shadow-soft">
              <h3 className="text-2xl font-black">Resumo</h3>
              <div className="mt-5 grid gap-3 text-sm">
                <SummaryRow label="Diárias" value={`${nights} noite(s)`} />
                <SummaryRow label="Valor por diária" value={currency.format(property.daily_rate)} />
                <SummaryRow label="Limpeza" value={nights > 0 ? currency.format(property.cleaning_fee) : '-'} />
                <SummaryRow label="Pagamento" value={paymentLabels[booking.payment_method]} />
                {booking.payment_method === 'card' ? (
                  <>
                    <SummaryRow label="Juros" value={`${cardQuote.rate}%`} />
                    <SummaryRow label="Parcela" value={`${cardQuote.installments}x de ${currency.format(cardQuote.installmentValue)}`} />
                  </>
                ) : null}
                <div className="mt-3 border-t border-ink/10 pt-4">
                  <SummaryRow label="Total estimado" value={currency.format(finalBookingTotal)} strong />
                </div>
              </div>
              <div className="mt-6 rounded-md bg-white p-4 text-sm leading-6 text-ink/70">
                Fidelidade: a cada 10 diárias confirmadas, 1 diária grátis é gerada. Esta casa tem {voucherSummary.available}{' '}
                voucher(s) disponível(is) no histórico atual.
              </div>
              <div className="mt-6 rounded-md bg-white p-4 text-sm leading-6 text-ink/70">
                Depois do envio, a reserva fica pendente até a confirmação do proprietário.
              </div>
              {message ? <p className="mt-4 rounded-md bg-mist px-4 py-3 text-sm font-semibold text-ink">{message}</p> : null}
              {lastWhatsAppUrl ? (
                <a
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition duration-200 ease-out hover:-translate-y-0.5"
                  href={lastWhatsAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ background: 'var(--property-accent)' }}
                >
                  <Mail size={18} />
                  Abrir e-mail
                </a>
              ) : null}
            </aside>
          </div>
        </section>

        <section id="sugestoes" className="bg-mist py-14 dark:bg-slate-900">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-black text-ink shadow-sm">
                <Sparkles size={16} />
                Sugestões
              </span>
              <h2 className="mt-4 text-3xl font-black text-ink dark:text-white">Ajude a melhorar sua experiência</h2>
              <p className="mt-3 max-w-2xl text-ink/70 dark:text-white/70">
                Envie ideias, ajustes ou melhorias. A sugestão fica registrada no sistema e abre um e-mail para o comercial.
              </p>
            </div>
            <SuggestionForm authProfile={authProfile} onSubmit={submitSuggestion} />
          </div>
        </section>
      </main>

      <div className="fixed bottom-5 right-5 z-40 grid gap-2">
        <a
          className="grid h-12 w-12 place-items-center rounded-full bg-green-600 text-white shadow-soft transition hover:-translate-y-0.5"
          href={buildWhatsAppUrl(property.owner_whatsapp || fallbackOwnerWhatsapp, `Olá, preciso de suporte sobre ${property.name}.`)}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
        >
          <MessageCircle size={20} />
        </a>
        <a
          className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink shadow-soft transition hover:-translate-y-0.5"
          href={`mailto:${fallbackOwnerEmail}?subject=${encodeURIComponent(`Suporte - ${property.name}`)}`}
          aria-label="Suporte por e-mail"
        >
          <Mail size={20} />
        </a>
      </div>

      <footer className="border-t border-ink/10 bg-ink px-4 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{property.name}</p>
          <p className="text-sm text-white/70">Reservas, calendario e check-in online.</p>
        </div>
      </footer>

      {adminOpen ? (
        <AdminPanel
          addProperty={addProperty}
          addPhoto={addPhoto}
          adminUnlocked={adminUnlocked}
          adminSession={adminSession}
          deleteProperty={deleteProperty}
          deletePhoto={deletePhoto}
          onClose={() => setAdminOpen(false)}
          onUnlock={() => setAdminUnlocked(true)}
          onSelectProperty={selectProperty}
          properties={adminProperties}
          property={adminProperty}
          propertyLicense={adminPropertyLicense}
          propertyPaymentSettings={adminPropertyPaymentSettings}
          propertyPhotos={adminPropertyPhotos}
          reservations={adminPropertyReservations}
          cashMovements={adminPropertyCashMovements}
          financialSummary={adminFinancialSummary}
          interestRates={interestRates}
          setInterestRates={setInterestRates}
          saveInterestRates={saveInterestRates}
          suggestions={suggestions}
          adminLogs={adminLogs}
          authProfile={authProfile}
          onSignOut={signOut}
          addAdminLog={addAdminLog}
          createManualReservation={createManualReservation}
          createPaymentLink={createPaymentLink}
          reorderPhoto={reorderPhoto}
          registerPayment={registerPayment}
          saveProperty={saveProperty}
          savePaymentSettings={savePaymentSettings}
          updateReservationDetails={updateReservationDetails}
          updateReservationStatus={updateReservationStatus}
        />
      ) : null}

      {authOpen ? (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthenticated={(profile) => {
            setAuthProfile(profile);
            setAdminUnlocked(['proprietario', 'super_admin'].includes(normalizeRole(profile.role)));
            setAuthOpen(false);
            navigateTo(roleHomePath(profile.role));
            if (normalizeRole(profile.role) === 'proprietario') setAdminOpen(true);
            if (normalizeRole(profile.role) === 'hospede') setClientPortalOpen(true);
          }}
          resolveAuthProfile={resolveAuthProfile}
        />
      ) : null}

      {passwordRecoveryOpen ? (
        <PasswordRecoveryModal onClose={() => setPasswordRecoveryOpen(false)} />
      ) : null}

      {clientPortalOpen ? (
        <ClientPortal
          authProfile={authProfile}
          reservations={reservations}
          properties={properties}
          onUpdateProfile={updateClientProfile}
          voucherSummary={getVoucherSummary(
            reservations.filter((reservation) => reservation.guest_email === authProfile?.email),
          )}
          onClose={() => setClientPortalOpen(false)}
          onSignOut={signOut}
        />
      ) : null}

    </div>
  );
}

function AccessDenied({ title, text, onLogin, onHome }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f8ff] p-4 text-ink">
      <div className="w-full max-w-md rounded-md bg-white p-6 text-center shadow-soft">
        <MaterialIcon name="lock" className="text-red-600" size={42} />
        <h1 className="mt-3 text-2xl font-black">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">{text}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={onLogin}>
            Entrar
          </Button>
          <Button type="button" variant="outline" onClick={onHome}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}

function SuperAdminDashboard({
  profiles,
  properties,
  reservations,
  cashMovements,
  licenses,
  setLicenses,
  licenseHistory,
  setLicenseHistory,
  setProfiles,
  setProperties,
  authProfile,
  onSignOut,
  onHome,
  addAdminLog,
}) {
  const [view, setView] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [licenseEdits, setLicenseEdits] = useState({});
  const [userNotice, setUserNotice] = useState('');
  const [licenseDraft, setLicenseDraft] = useState({
    owner_id: '',
    property_id: '',
    plan: 'mensal',
    status: 'trial',
    starts_at: format(new Date(), 'yyyy-MM-dd'),
    expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    monthly_value: 0,
    property_limit: 1,
    notes: '',
  });

  const owners = profiles.filter((profile) => normalizeRole(profile.role) === 'proprietario');
  const guests = profiles.filter((profile) => normalizeRole(profile.role) === 'hospede');
  const visibleLicenses = licenses.filter((license) => {
    const owner = profiles.find((profile) => profile.id === license.owner_id);
    const property = properties.find((item) => item.id === license.property_id);
    const text = `${license.license_key || ''} ${license.plan || ''} ${owner?.email || ''} ${property?.name || ''}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });
  const stats = {
    owners: owners.length,
    guests: guests.length,
    properties: properties.length,
    reservations: reservations.length,
    pending: reservations.filter((reservation) => reservation.status === 'pending').length,
    confirmed: reservations.filter((reservation) => reservation.status === 'confirmed').length,
    cancelled: reservations.filter((reservation) => reservation.status === 'cancelled').length,
    activeLicenses: licenses.filter((license) => normalizeLicenseStatus(license) === 'active').length,
    expiredLicenses: licenses.filter((license) => normalizeLicenseStatus(license) === 'expired').length,
    activeClients: licenses.filter((license) => ['active', 'trial'].includes(normalizeLicenseStatus(license))).length,
    monthlyRevenue: cashMovements
      .filter((movement) => String(movement.due_date || '').slice(0, 7) === format(new Date(), 'yyyy-MM'))
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0),
  };
  const monthlyChart = buildMonthlyRows(cashMovements, reservations);
  const growthChart = buildGrowthRows(profiles);
  const menu = [
    ['dashboard', 'Dashboard', 'dashboard'],
    ['users', 'Usuários', 'admin_panel_settings'],
    ['owners', 'Proprietários', 'manage_accounts'],
    ['guests', 'Hóspedes', 'group'],
    ['licenses', 'Licenças', 'vpn_key'],
    ['reservations', 'Reservas', 'calendar_month'],
    ['financial', 'Financeiro', 'payments'],
    ['settings', 'Configurações', 'settings'],
  ];

  function syncPropertyLicense(savedLicense) {
    if (!savedLicense?.property_id) return;
    const status = normalizeLicenseStatus(savedLicense);
    setProperties((current) =>
      current.map((item) =>
        item.id === savedLicense.property_id
          ? {
              ...item,
              license_key: savedLicense.license_key,
              license_expires_at: savedLicense.expires_at || '',
              license_active: ['active', 'trial'].includes(status),
            }
          : item,
      ),
    );
  }

  function rememberLicenseHistory(entry) {
    setLicenseHistory((current) => [{ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...entry }, ...current]);
  }

  async function updateUserRole(profile, role) {
    const normalizedRole = normalizeRole(role);
    if (!profile?.id || !['super_admin', 'proprietario', 'hospede'].includes(normalizedRole)) return;
    if (isSuperAdminEmail(profile.email) && normalizedRole !== 'super_admin') {
      setUserNotice('O e-mail principal de Super Admin não pode ser rebaixado.');
      return;
    }

    setProfiles((current) => current.map((item) => (item.id === profile.id ? { ...item, role: normalizedRole } : item)));
    if (hasSupabaseConfig) {
      const { error } = await supabase.from('profiles').update({ role: normalizedRole }).eq('id', profile.id);
      if (error) {
        setProfiles((current) => current.map((item) => (item.id === profile.id ? profile : item)));
        setUserNotice('Não foi possível alterar a permissão. Confira as policies do Supabase.');
        return;
      }
    }
    setUserNotice(`${profile.email} atualizado para ${roleLabels[normalizedRole] || normalizedRole}.`);
    await addAdminLog('super_admin_role_updated', { user_id: profile.id, email: profile.email, role: normalizedRole });
  }

  async function upsertLicense(payload) {
    const normalized = {
      ...payload,
      license_key: payload.license_key || generateLicenseKey(),
      owner_id: payload.owner_id || null,
      property_id: payload.property_id || null,
      monthly_value: Number(payload.monthly_value || 0),
      property_limit: Number(payload.property_limit || 1),
    };
    let saved = { ...normalized, id: normalized.id || crypto.randomUUID(), created_at: normalized.created_at || new Date().toISOString() };
    if (hasSupabaseConfig) {
      const { data, error } = await supabase.from('licenses').upsert(normalized).select().single();
      if (error) return;
      saved = data;
    }
    setLicenses((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current];
    });
    syncPropertyLicense(saved);
    const historyEntry = {
      license_id: saved.id,
      action: payload.id ? 'updated' : 'created',
      actor_email: authProfile?.email,
      details: { status: saved.status, plan: saved.plan, expires_at: saved.expires_at },
    };
    rememberLicenseHistory(historyEntry);
    if (hasSupabaseConfig) {
      await supabase.from('license_history').insert(historyEntry);
    }
    await addAdminLog('super_admin_license_saved', { license_id: saved.id, status: saved.status });
  }

  async function updateLicense(license, updates) {
    await upsertLicense({ ...license, ...updates });
  }

  async function deleteLicense(licenseId) {
    const deletedLicense = licenses.find((license) => license.id === licenseId);
    setLicenses((current) => current.filter((license) => license.id !== licenseId));
    if (deletedLicense?.property_id) {
      setProperties((current) =>
        current.map((item) =>
          item.id === deletedLicense.property_id
            ? { ...item, license_key: '', license_expires_at: '', license_active: false }
            : item,
        ),
      );
    }
    if (hasSupabaseConfig) await supabase.from('licenses').delete().eq('id', licenseId);
    await addAdminLog('super_admin_license_deleted', { license_id: licenseId });
  }

  return (
    <div className="min-h-screen bg-[#eef4ff] text-ink">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-ink/10 bg-white p-4">
          <div className="flex items-center gap-3 rounded-md bg-ink p-4 text-white">
            <MaterialIcon name="admin_panel_settings" size={28} />
            <div>
              <p className="font-black">Super Admin</p>
              <p className="text-xs text-white/65">{authProfile?.email}</p>
            </div>
          </div>
          <nav className="mt-5 grid gap-1">
            {menu.map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-black transition ${
                  view === key ? 'bg-leaf text-white' : 'hover:bg-mist'
                }`}
                onClick={() => setView(key)}
              >
                <MaterialIcon name={icon} size={20} />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-5 grid gap-2">
            <Button type="button" variant="outline" onClick={onHome}>
              Site
            </Button>
            <Button type="button" variant="secondary" onClick={onSignOut}>
              Sair
            </Button>
          </div>
        </aside>
        <main className="overflow-auto p-4 sm:p-6">
          <header className="mb-6 flex flex-col gap-3 rounded-md bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink/50">HospedeX</p>
              <h1 className="text-2xl font-black">Gestão total do sistema</h1>
            </div>
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar licenças, proprietários..." />
          </header>

          {view === 'dashboard' ? (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SuperStat icon="manage_accounts" label="Proprietários" value={stats.owners} />
                <SuperStat icon="group" label="Hóspedes" value={stats.guests} />
                <SuperStat icon="home_work" label="Imóveis" value={stats.properties} />
                <SuperStat icon="event_available" label="Reservas" value={stats.reservations} />
                <SuperStat icon="payments" label="Receita mensal" value={currency.format(stats.monthlyRevenue)} />
                <SuperStat icon="pending_actions" label="Pendentes" value={stats.pending} />
                <SuperStat icon="task_alt" label="Confirmadas" value={stats.confirmed} />
                <SuperStat icon="cancel" label="Canceladas" value={stats.cancelled} />
                <SuperStat icon="vpn_key" label="Licenças ativas" value={stats.activeLicenses} />
                <SuperStat icon="warning" label="Licenças vencidas" value={stats.expiredLicenses} />
                <SuperStat icon="verified_user" label="Clientes ativos" value={stats.activeClients} />
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <SuperChart title="Receita e reservas mensais" rows={monthlyChart} valueKey="revenue" labelKey="monthKey" />
                <SuperChart title="Crescimento de usuários" rows={growthChart} valueKey="count" labelKey="monthKey" />
              </div>
            </div>
          ) : null}

          {view === 'users' ? (
            <SuperUsersTable title="Usuários" rows={profiles} notice={userNotice} onRoleChange={updateUserRole} />
          ) : null}
          {view === 'owners' ? (
            <SuperUsersTable title="Proprietários" rows={owners} notice={userNotice} onRoleChange={updateUserRole} />
          ) : null}
          {view === 'guests' ? (
            <SuperUsersTable title="Hóspedes" rows={guests} notice={userNotice} onRoleChange={updateUserRole} />
          ) : null}
          {view === 'reservations' ? (
            <SuperTable title="Reservas" rows={reservations} columns={['guest_name', 'guest_email', 'check_in', 'check_out', 'status']} />
          ) : null}
          {view === 'financial' ? (
            <SuperTable title="Financeiro" rows={cashMovements} columns={['due_date', 'description', 'status', 'payment_method', 'amount']} />
          ) : null}
          {view === 'licenses' ? (
            <div className="grid gap-5">
              <form
                className="grid gap-4 rounded-md bg-white p-4 shadow-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  upsertLicense(licenseDraft);
                  setLicenseDraft({
                    owner_id: '',
                    property_id: '',
                    plan: 'mensal',
                    status: 'trial',
                    starts_at: format(new Date(), 'yyyy-MM-dd'),
                    expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
                    monthly_value: 0,
                    property_limit: 1,
                    notes: '',
                  });
                }}
              >
                <h2 className="text-xl font-black">Gerar licença</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Proprietário">
                    <SelectInput value={licenseDraft.owner_id} onChange={(event) => setLicenseDraft({ ...licenseDraft, owner_id: event.target.value })}>
                      <option value="">Selecione</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.email}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Imóvel">
                    <SelectInput value={licenseDraft.property_id} onChange={(event) => setLicenseDraft({ ...licenseDraft, property_id: event.target.value })}>
                      <option value="">Opcional</option>
                      {properties.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Plano">
                    <TextInput value={licenseDraft.plan} onChange={(event) => setLicenseDraft({ ...licenseDraft, plan: event.target.value })} />
                  </Field>
                  <Field label="Status">
                    <SelectInput value={licenseDraft.status} onChange={(event) => setLicenseDraft({ ...licenseDraft, status: event.target.value })}>
                      <option value="active">Ativa</option>
                      <option value="expired">Vencida</option>
                      <option value="suspended">Suspensa</option>
                      <option value="trial">Teste</option>
                    </SelectInput>
                  </Field>
                  <Field label="Início">
                    <TextInput type="date" value={licenseDraft.starts_at} onChange={(event) => setLicenseDraft({ ...licenseDraft, starts_at: event.target.value })} />
                  </Field>
                  <Field label="Vencimento">
                    <TextInput type="date" value={licenseDraft.expires_at} onChange={(event) => setLicenseDraft({ ...licenseDraft, expires_at: event.target.value })} />
                  </Field>
                  <Field label="Valor mensal">
                    <TextInput type="number" value={licenseDraft.monthly_value} onChange={(event) => setLicenseDraft({ ...licenseDraft, monthly_value: event.target.value })} />
                  </Field>
                  <Field label="Limite de imóveis">
                    <TextInput type="number" value={licenseDraft.property_limit} onChange={(event) => setLicenseDraft({ ...licenseDraft, property_limit: event.target.value })} />
                  </Field>
                </div>
                <Field label="Observações">
                  <TextArea value={licenseDraft.notes} onChange={(event) => setLicenseDraft({ ...licenseDraft, notes: event.target.value })} />
                </Field>
                <Button type="submit">
                  <MaterialIcon name="vpn_key" />
                  Gerar chave
                </Button>
              </form>
              <div className="grid gap-3">
                {visibleLicenses.map((license) => {
                  const edit = licenseEdits[license.id] || {};
                  const mergedLicense = { ...license, ...edit };
                  const status = normalizeLicenseStatus(mergedLicense);
                  const owner = profiles.find((profile) => profile.id === license.owner_id);
                  const history = licenseHistory.filter((item) => item.license_id === license.id).slice(0, 3);
                  return (
                    <div key={license.id} className="grid gap-4 rounded-md bg-white p-4 shadow-sm">
                      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-start">
                      <div>
                        <p className="font-black">{license.license_key}</p>
                        <p className="text-sm text-ink/65">
                          {owner?.email || 'Sem proprietário'} - {license.plan || 'Plano'} - {licenseStatusLabels[status] || status}
                        </p>
                        <p className="mt-1 text-sm text-ink/65">
                          Vence em {license.expires_at || '-'} - {currency.format(license.monthly_value || 0)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => updateLicense(license, { status: 'active', expires_at: format(addDays(new Date(), 30), 'yyyy-MM-dd') })}>
                          Renovar
                        </Button>
                        <Button type="button" variant="outline" onClick={() => updateLicense(license, { status: 'suspended' })}>
                          Suspender
                        </Button>
                        <Button type="button" variant="outline" onClick={() => updateLicense(license, { status: 'active' })}>
                          Liberar
                        </Button>
                        <Button type="button" variant="outline" onClick={() => deleteLicense(license.id)}>
                          Excluir
                        </Button>
                      </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-5">
                        <Field label="Plano">
                          <TextInput
                            value={mergedLicense.plan || ''}
                            onChange={(event) =>
                              setLicenseEdits((current) => ({
                                ...current,
                                [license.id]: { ...current[license.id], plan: event.target.value },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Status">
                          <SelectInput
                            value={mergedLicense.status || 'trial'}
                            onChange={(event) =>
                              setLicenseEdits((current) => ({
                                ...current,
                                [license.id]: { ...current[license.id], status: event.target.value },
                              }))
                            }
                          >
                            <option value="active">Ativa</option>
                            <option value="expired">Vencida</option>
                            <option value="suspended">Suspensa</option>
                            <option value="trial">Teste</option>
                          </SelectInput>
                        </Field>
                        <Field label="Vencimento">
                          <TextInput
                            type="date"
                            value={mergedLicense.expires_at || ''}
                            onChange={(event) =>
                              setLicenseEdits((current) => ({
                                ...current,
                                [license.id]: { ...current[license.id], expires_at: event.target.value },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Valor mensal">
                          <TextInput
                            type="number"
                            value={mergedLicense.monthly_value || 0}
                            onChange={(event) =>
                              setLicenseEdits((current) => ({
                                ...current,
                                [license.id]: { ...current[license.id], monthly_value: event.target.value },
                              }))
                            }
                          />
                        </Field>
                        <Field label="Limite">
                          <TextInput
                            type="number"
                            value={mergedLicense.property_limit || 1}
                            onChange={(event) =>
                              setLicenseEdits((current) => ({
                                ...current,
                                [license.id]: { ...current[license.id], property_limit: event.target.value },
                              }))
                            }
                          />
                        </Field>
                      </div>
                      <Field label="Observações">
                        <TextArea
                          value={mergedLicense.notes || ''}
                          onChange={(event) =>
                            setLicenseEdits((current) => ({
                              ...current,
                              [license.id]: { ...current[license.id], notes: event.target.value },
                            }))
                          }
                        />
                      </Field>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3">
                        <div className="text-xs font-semibold text-ink/55">
                          {history.length
                            ? history.map((item) => `${item.action} em ${format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')}`).join(' | ')
                            : 'Sem histórico registrado.'}
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            updateLicense(license, licenseEdits[license.id] || {});
                            setLicenseEdits((current) => {
                              const next = { ...current };
                              delete next[license.id];
                              return next;
                            });
                          }}
                        >
                          <MaterialIcon name="save" size={18} />
                          Salvar alterações
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {view === 'settings' ? (
            <div className="rounded-md bg-white p-4 shadow-sm">
              <h2 className="text-xl font-black">Configurações de segurança</h2>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                A rota `/super-admin` não aparece em menus públicos. O acesso é validado pelo role `super_admin` no frontend e pelas
                policies/funções do Supabase.
              </p>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function buildMonthlyRows(cashMovements, reservations) {
  const grouped = new Map();
  cashMovements.forEach((movement) => {
    const key = String(movement.paid_at || movement.due_date || '').slice(0, 7) || 'Sem data';
    const current = grouped.get(key) || { monthKey: key, revenue: 0, reservations: 0 };
    current.revenue += Number(movement.amount || 0);
    grouped.set(key, current);
  });
  reservations.forEach((reservation) => {
    const key = String(reservation.check_in || '').slice(0, 7) || 'Sem data';
    const current = grouped.get(key) || { monthKey: key, revenue: 0, reservations: 0 };
    current.reservations += 1;
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)).slice(-6);
}

function buildGrowthRows(profiles) {
  const grouped = new Map();
  profiles.forEach((profile) => {
    const key = String(profile.created_at || '').slice(0, 7) || 'Sem data';
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([monthKey, count]) => ({ monthKey, count }));
}

function SuperStat({ icon, label, value }) {
  return (
    <div className="rounded-md bg-white p-4 shadow-sm">
      <MaterialIcon name={icon} className="text-leaf" size={24} />
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function SuperChart({ title, rows, valueKey, labelKey }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
  return (
    <div className="rounded-md bg-white p-4 shadow-sm">
      <h2 className="font-black">{title}</h2>
      <div className="mt-4 grid gap-3">
        {rows.length ? (
          rows.map((row) => (
            <div key={row[labelKey]} className="grid gap-2 sm:grid-cols-[90px_1fr_120px] sm:items-center">
              <span className="text-xs font-bold text-ink/55">{row[labelKey]}</span>
              <div className="h-3 overflow-hidden rounded-full bg-mist">
                <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.max(8, (Number(row[valueKey] || 0) / max) * 100)}%` }} />
              </div>
              <span className="text-sm font-black sm:text-right">
                {valueKey === 'revenue' ? currency.format(row[valueKey] || 0) : row[valueKey] || 0}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-ink/60">Sem dados suficientes.</p>
        )}
      </div>
    </div>
  );
}

function SuperUsersTable({ title, rows, notice, onRoleChange }) {
  return (
    <div className="grid gap-3 rounded-md bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-black">{title}</h2>
        {notice ? <p className="text-sm font-bold text-leaf">{notice}</p> : null}
      </div>
      <div className="grid gap-3">
        {rows.length ? (
          rows.map((profile) => {
            const role = normalizeRole(profile.role);
            return (
              <div key={profile.id || profile.email} className="grid gap-3 rounded-md border border-ink/10 bg-[#f8fbff] p-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="font-black">{profile.full_name || profile.email}</p>
                  <p className="text-sm font-semibold text-ink/65">{profile.email}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-wide text-ink/50">
                    {roleLabels[role] || role || 'Sem role'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {[
                    ['super_admin', 'Super Admin'],
                    ['proprietario', 'Proprietário'],
                    ['hospede', 'Hóspede'],
                  ].map(([nextRole, label]) => (
                    <Button
                      key={nextRole}
                      type="button"
                      variant={role === nextRole ? 'secondary' : 'outline'}
                      className="px-3"
                      onClick={() => onRoleChange(profile, nextRole)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-md bg-[#f8fbff] p-4 text-sm font-semibold text-ink/60">Nenhum usuário encontrado.</p>
        )}
      </div>
    </div>
  );
}

function SuperTable({ title, rows, columns }) {
  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="border-b border-ink/10 p-4">
        <h2 className="text-xl font-black">{title}</h2>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-mist text-xs uppercase tracking-wide text-ink/55">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id || JSON.stringify(row)} className="border-t border-ink/10">
                  {columns.map((column) => (
                    <td key={column} className="px-4 py-3">
                      {column === 'role' ? roleLabels[normalizeRole(row[column])] || row[column] : String(row[column] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-ink/60" colSpan={columns.length}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuthModal({ onClose, onAuthenticated, resolveAuthProfile }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const socialProviders = [
    ['google', 'Google'],
    ['facebook', 'Facebook'],
    ['apple', 'Apple'],
  ];

  async function signInWithProvider(provider) {
    setError('');
    setNotice('');
    if (!hasSupabaseConfig) {
      setError('Configure o Supabase Auth para usar login social.');
      return;
    }
    const { error: providerError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (providerError) setError(`Nao foi possivel entrar com ${provider}.`);
  }

  async function sendPasswordReset() {
    setError('');
    setNotice('');
    if (!hasSupabaseConfig) {
      setError('Supabase não está configurado para recuperação de senha.');
      return;
    }
    if (!form.email.trim()) {
      setError('Informe o e-mail para receber o link de recuperação.');
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: window.location.origin,
    });
    if (resetError) {
      setError('Não foi possível enviar a recuperação de senha agora.');
      return;
    }
    setNotice('Enviamos um link de recuperação para esse e-mail.');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);

    if (!hasSupabaseConfig) {
      if (canUsePasswordAdmin && isPrivilegedEmail(form.email.trim()) && form.password === adminPassword) {
        const role = isSuperAdminEmail(form.email.trim()) ? 'super_admin' : 'proprietario';
        const profile = { id: 'local-admin', email: form.email.trim(), role, full_name: 'Administrador' };
        onAuthenticated(profile);
        setSubmitting(false);
        return;
      }
      setError('Cadastro e login de usuários precisam do Supabase configurado.');
      setNotice('Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel para salvar usuários reais.');
      setSubmitting(false);
      return;
    }

    if (mode === 'signup') {
      if (isPrivilegedEmail(form.email.trim())) {
        setError('Administradores não são cadastrados pela tela pública.');
        setNotice('Crie o usuário no Supabase e promova para proprietário pelo Super Admin.');
        setSubmitting(false);
        return;
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { full_name: form.full_name, phone: form.phone },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) {
        const alreadyRegistered = /already|registered|exists/i.test(signUpError.message || '');
        setError(
          alreadyRegistered
            ? 'Este e-mail já tem cadastro. Use Login ou Recuperar senha.'
            : 'Não foi possível criar a conta de hóspede. Confira os dados.',
        );
        setSubmitting(false);
        return;
      }
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: form.email.trim(),
          full_name: form.full_name,
          phone: form.phone,
          role: getAuthRole(null, form.email.trim()),
        });
      }
      if (data.session) {
        const profile = await resolveAuthProfile(data.session);
        onAuthenticated(profile);
        setSubmitting(false);
        return;
      }
      setNotice('Conta de hóspede criada. Confirme o e-mail se o Supabase solicitar e depois entre normalmente.');
      setMode('login');
      setSubmitting(false);
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    if (signInError?.message === 'Email not confirmed') {
      setError('E-mail ainda não confirmado no Supabase.');
      setNotice('Verifique a caixa de entrada ou desative a confirmação de e-mail no Supabase Auth durante testes.');
      setSubmitting(false);
      return;
    }
    if (signInError || !data.session) {
      setError('Login não autorizado. Confira e-mail e senha.');
      setSubmitting(false);
      return;
    }
    const profile = await resolveAuthProfile(data.session);
    onAuthenticated(profile);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur">
      <form className="grid w-full max-w-md rounded-md bg-white p-5 text-ink shadow-soft sm:max-w-lg sm:p-6" onSubmit={submit}>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose} aria-label="Fechar login" className="min-h-9 px-3 py-1.5">
            <MaterialIcon name="close" size={16} />
          </Button>
        </div>
        <div className="grid justify-items-center gap-1.5 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-md text-white" style={{ background: 'var(--property-accent)' }}>
            <MaterialIcon name="door_open" size={20} />
          </div>
          <h2 className="text-xl font-black">{mode === 'login' ? 'Login' : 'Cadastro'}</h2>
          <p className="max-w-xs text-xs leading-5 text-ink/55">
            {mode === 'login'
              ? 'Entre para acessar o portal correto da sua conta.'
              : 'Crie sua conta para acompanhar reservas e solicitações.'}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-mist p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-2.5 text-sm font-black ${mode === 'login' ? 'bg-white shadow-sm' : ''}`}
            onClick={() => {
              setMode('login');
              setError('');
              setNotice('');
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2.5 text-sm font-black ${mode === 'signup' ? 'bg-white shadow-sm' : ''}`}
            onClick={() => {
              setMode('signup');
              setError('');
              setNotice('');
            }}
          >
            Cadastro
          </button>
        </div>
        {!hasSupabaseConfig ? (
          <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Cadastro de usuários está desativado até conectar o Supabase na Vercel.
          </p>
        ) : null}
        <div className="mt-4 grid gap-3.5">
          {mode === 'signup' ? (
            <div className="grid gap-3.5 md:grid-cols-2 md:gap-4">
              <Field label="Nome completo">
                <TextInput value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
              </Field>
              <Field label="Telefone">
                <TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </Field>
            </div>
          ) : null}
          <Field label="E-mail">
            <TextInput
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
              autoComplete="username"
            />
          </Field>
          <Field label="Senha">
            <TextInput
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
          <Button type="submit" disabled={submitting}>
            <MaterialIcon name={mode === 'login' ? 'lock' : 'person_add'} size={18} />
            {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </Button>
          {mode === 'login' && hasSupabaseConfig ? (
            <button type="button" className="text-right text-xs font-bold text-leaf" onClick={sendPasswordReset}>
              Recuperar senha
            </button>
          ) : null}
          {mode === 'login' && hasSupabaseConfig ? (
            <div className="grid gap-2 pt-1">
              <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-ink/40">
                <span className="h-px flex-1 bg-ink/10" />
                Ou entre com
                <span className="h-px flex-1 bg-ink/10" />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {socialProviders.map(([provider, label]) => (
                  <Button
                    key={provider}
                    type="button"
                    variant="outline"
                    className="min-h-10 px-3 py-2"
                    onClick={() => signInWithProvider(provider)}
                    aria-label={`Entrar com ${label}`}
                    title={label}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <p className="text-center text-xs text-ink/55">
            {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button
              type="button"
              className="font-black text-leaf"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError('');
                setNotice('');
              }}
            >
              {mode === 'login' ? 'Criar cadastro' : 'Entrar'}
            </button>
          </p>
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          {notice ? <p className="text-sm leading-6 text-ink/70">{notice}</p> : null}
        </div>
      </form>
    </div>
  );
}

function PasswordRecoveryModal({ onClose }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (password.length < 6) {
      setError('Use uma senha com pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError('Não foi possível alterar a senha agora.');
      return;
    }
    setMessage('Senha alterada. Você já pode entrar normalmente.');
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/60 p-4 backdrop-blur">
      <form className="w-full max-w-md rounded-md bg-white p-5 text-ink shadow-soft" onSubmit={submit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Criar nova senha</h2>
            <p className="mt-1 text-sm text-ink/65">Defina uma nova senha para acessar sua conta.</p>
          </div>
          <Button type="button" variant="outline" onClick={onClose} aria-label="Fechar recuperação">
            <X size={18} />
          </Button>
        </div>
        <div className="mt-5 grid gap-4">
          <Field label="Nova senha">
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirmar senha">
            <TextInput
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </Field>
          <Button type="submit">
            <Save size={18} />
            Salvar nova senha
          </Button>
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-leaf">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}

function ClientPortal({ authProfile, reservations, properties, onUpdateProfile, voucherSummary, onClose, onSignOut }) {
  const clientReservations = reservations
    .filter((reservation) => reservation.guest_email === authProfile?.email)
    .sort((a, b) => String(b.created_at || b.check_in).localeCompare(String(a.created_at || a.check_in)));
  const currentReservation = clientReservations.find((reservation) => ['pending', 'confirmed'].includes(reservation.status));
  const [view, setView] = useState('dashboard');
  const [profileDraft, setProfileDraft] = useState({
    full_name: authProfile?.full_name || '',
    phone: authProfile?.phone || '',
  });
  const [profileNotice, setProfileNotice] = useState('');
  const pendingReservations = clientReservations.filter((reservation) => reservation.status === 'pending');
  const confirmedReservations = clientReservations.filter((reservation) => reservation.status === 'confirmed');
  const cancelledReservations = clientReservations.filter((reservation) => reservation.status === 'cancelled');
  const menu = [
    ['dashboard', 'Dashboard', 'dashboard'],
    ['reservations', 'Minhas reservas', 'calendar_month'],
    ['requests', 'Solicitações', 'fact_check'],
    ['settings', 'Configurações', 'settings'],
    ['profile', 'Dados pessoais', 'person'],
    ['status', 'Status atual', 'verified_user'],
  ];

  async function submitProfile(event) {
    event.preventDefault();
    await onUpdateProfile(profileDraft);
    setProfileNotice('Dados pessoais atualizados.');
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 p-3 backdrop-blur">
      <div className="mx-auto grid h-full max-w-6xl overflow-hidden rounded-md bg-[#f4f8ff] text-ink shadow-soft lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-ink/10 bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 lg:block">
            <div>
              <h2 className="text-xl font-black">Portal do cliente</h2>
              <p className="mt-1 text-xs font-semibold text-ink/55">{authProfile?.email}</p>
            </div>
            <Button type="button" variant="outline" onClick={onClose} className="lg:hidden">
              <X size={18} />
            </Button>
          </div>
          <nav className="mt-5 grid gap-2">
            {menu.map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-black transition ${
                  view === key ? 'bg-ink text-white' : 'hover:bg-mist'
                }`}
                onClick={() => setView(key)}
              >
                <MaterialIcon name={icon} size={18} />
                {label}
              </button>
            ))}
          </nav>
          <Button type="button" variant="outline" onClick={onSignOut} className="mt-5 w-full">
            <MaterialIcon name="logout" size={18} />
            Sair
          </Button>
        </aside>
        <main className="overflow-auto p-5">
          <div className="hidden justify-end lg:flex">
            <Button type="button" variant="outline" onClick={onClose}>
              <X size={18} />
              Fechar
            </Button>
          </div>
          {view === 'dashboard' ? (
            <div className="grid gap-5">
              <h3 className="text-2xl font-black">Dashboard</h3>
              <div className="grid gap-4 md:grid-cols-4">
                <PortalCard label="Solicitações" value={clientReservations.length} icon="fact_check" />
                <PortalCard label="Pendentes" value={pendingReservations.length} icon="pending_actions" />
                <PortalCard label="Aceitas" value={confirmedReservations.length} icon="verified_user" />
                <PortalCard label="Vouchers disponíveis" value={voucherSummary.available} icon="redeem" />
              </div>
              <div className="rounded-md bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">Solicitação atual</p>
                    <p className="mt-1 text-sm text-ink/65">
                      {currentReservation
                        ? `${reservationStatusLabels[currentReservation.status]} - ${currentReservation.check_in} até ${currentReservation.check_out}`
                        : 'Nenhuma solicitação ativa no momento.'}
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setView('requests')}>
                    Ver solicitações
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {view === 'reservations' || view === 'requests' ? (
            <div className="grid gap-4">
              <div>
                <h3 className="text-2xl font-black">
                  {view === 'requests' ? 'Solicitações de reserva' : 'Histórico de reservas'}
                </h3>
                <p className="mt-1 text-sm text-ink/65">
                  Acompanhe as reservas que você solicitou, as pendentes e as aceitas pelo administrador.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <PortalCard label="Pendentes" value={pendingReservations.length} icon="pending_actions" />
                <PortalCard label="Aceitas" value={confirmedReservations.length} icon="verified_user" />
                <PortalCard label="Canceladas" value={cancelledReservations.length} icon="cancel" />
              </div>
              {clientReservations.length ? (
                clientReservations.map((reservation) => {
                  const property = properties.find((item) => item.id === reservation.property_id);
                  const statusStyle =
                    reservation.status === 'confirmed'
                      ? 'bg-leaf/10 text-leaf'
                      : reservation.status === 'pending'
                        ? 'bg-amber-50 text-amber-700'
                        : reservation.status === 'cancelled'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-blue-50 text-blue-700';
                  return (
                    <div key={reservation.id} className="grid gap-4 rounded-md bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{property?.name || 'Casa'}</p>
                          <p className="mt-1 text-sm text-ink/65">
                            {reservation.check_in} até {reservation.check_out} · {reservation.guests} hóspede(s)
                          </p>
                        </div>
                        <span className={`rounded-md px-3 py-2 text-xs font-black ${statusStyle}`}>
                          {reservationStatusLabels[reservation.status] || reservation.status}
                        </span>
                      </div>
                      <div className="grid gap-3 text-sm sm:grid-cols-3">
                        <div className="rounded-md bg-[#f4f8ff] p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-ink/50">Total</p>
                          <p className="mt-1 font-black">{currency.format(reservation.total_amount || 0)}</p>
                        </div>
                        <div className="rounded-md bg-[#f4f8ff] p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-ink/50">Pagamento</p>
                          <p className="mt-1 font-black">{paymentLabels[reservation.payment_method] || reservation.payment_method}</p>
                        </div>
                        <div className="rounded-md bg-[#f4f8ff] p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-ink/50">Situação do pagamento</p>
                          <p className="mt-1 font-black">{paymentStatusLabels[reservation.payment_status] || reservation.payment_status}</p>
                        </div>
                      </div>
                      {reservation.notes ? <p className="text-sm leading-6 text-ink/65">{reservation.notes}</p> : null}
                    </div>
                  );
                })
              ) : (
                <EmptyState title="Nenhuma solicitação encontrada" text="Suas reservas aparecerão aqui depois da solicitação." />
              )}
            </div>
          ) : null}
          {view === 'settings' || view === 'profile' ? (
            <div className="grid gap-4">
              <h3 className="text-2xl font-black">{view === 'profile' ? 'Dados pessoais' : 'Configurações'}</h3>
              <form className="grid gap-4 rounded-md bg-white p-4 shadow-sm" onSubmit={submitProfile}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome completo">
                    <TextInput
                      value={profileDraft.full_name}
                      onChange={(event) => setProfileDraft({ ...profileDraft, full_name: event.target.value })}
                      placeholder="Seu nome"
                    />
                  </Field>
                  <Field label="Telefone">
                    <TextInput
                      value={profileDraft.phone}
                      onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </Field>
                </div>
                <div className="rounded-md bg-[#f4f8ff] p-3 text-sm text-ink/70">
                  <strong>E-mail:</strong> {authProfile?.email || '-'}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {profileNotice ? <p className="text-sm font-semibold text-leaf">{profileNotice}</p> : <span />}
                  <Button type="submit">
                    <Save size={18} />
                    Salvar dados
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
          {view === 'status' ? (
            <div className="grid gap-4">
              <h3 className="text-2xl font-black">Status atual</h3>
              <div className="rounded-md bg-white p-4 shadow-sm">
                <p className="text-lg font-black">{reservationStatusLabels[currentReservation?.status] || 'Sem reserva ativa'}</p>
                <p className="mt-2 text-sm text-ink/65">
                  Diárias acumuladas: {voucherSummary.confirmedNights}. Vouchers disponíveis: {voucherSummary.available}.
                </p>
              </div>
              {currentReservation ? (
                <div className="rounded-md bg-white p-4 shadow-sm">
                  <p className="font-black">Próxima solicitação</p>
                  <p className="mt-2 text-sm text-ink/65">
                    {currentReservation.check_in} até {currentReservation.check_out} ·{' '}
                    {currency.format(currentReservation.total_amount || 0)}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SuggestionForm({ authProfile, onSubmit }) {
  const [form, setForm] = useState({ name: authProfile?.full_name || '', email: authProfile?.email || '', message: '' });
  const [status, setStatus] = useState('idle');

  return (
    <form
      className="grid gap-4 rounded-md bg-white p-5 shadow-soft"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!form.message.trim()) return;
        setStatus('loading');
        try {
          await onSubmit(form);
          setStatus('success');
          setForm({ name: authProfile?.full_name || '', email: authProfile?.email || '', message: '' });
        } catch {
          setStatus('error');
        }
      }}
    >
      <Field label="Nome">
        <TextInput
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Seu nome"
        />
      </Field>
      <Field label="Seu e-mail">
        <TextInput
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="voce@email.com"
        />
      </Field>
      <Field label="Sugestão">
        <TextArea
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
          placeholder="Conte o que pode melhorar"
          required
        />
      </Field>
      <Button type="submit">
        <MaterialIcon name="mail" size={18} />
        {status === 'loading' ? 'Enviando...' : 'Enviar sugestão'}
      </Button>
      {status === 'success' ? <p className="text-sm font-semibold text-green-700">Sugestão enviada com sucesso.</p> : null}
      {status === 'error' ? <p className="text-sm font-semibold text-red-700">Não foi possível enviar agora.</p> : null}
    </form>
  );
}

function PortalCard({ icon: Icon, label, value }) {
  const isMaterialIcon = typeof Icon === 'string';
  return (
    <div className="rounded-md bg-white p-4 shadow-sm">
      {isMaterialIcon ? <MaterialIcon name={Icon} className="text-leaf" size={20} /> : <Icon className="text-leaf" size={20} />}
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-md border border-dashed border-ink/20 bg-white p-6 text-center">
      <p className="font-black">{title}</p>
      <p className="mt-2 text-sm text-ink/60">{text}</p>
    </div>
  );
}

function ManualReservationEditor({ reservation, onSave }) {
  const [draft, setDraft] = useState({
    check_in: reservation.check_in || '',
    check_out: reservation.check_out || '',
    guests: reservation.guests || 1,
    total_amount: reservation.total_amount || 0,
    status: reservation.status || 'blocked',
    notes: reservation.notes || '',
  });

  return (
    <form
      className="mt-3 grid gap-3 rounded-md bg-[#f4f8ff] p-3"
      onClick={(event) => event.stopPropagation()}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(reservation.id, draft);
      }}
    >
      <p className="font-black text-ink">Ajustar reserva manual</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Check-in">
          <TextInput type="date" value={draft.check_in} onChange={(event) => setDraft({ ...draft, check_in: event.target.value })} />
        </Field>
        <Field label="Check-out">
          <TextInput type="date" value={draft.check_out} onChange={(event) => setDraft({ ...draft, check_out: event.target.value })} />
        </Field>
        <Field label="Status">
          <SelectInput value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="blocked">Bloqueado manualmente</option>
            <option value="cancelled">Cancelado</option>
            <option value="maintenance">Manutenção</option>
          </SelectInput>
        </Field>
        <Field label="Valor">
          <TextInput
            type="number"
            value={draft.total_amount}
            onChange={(event) => setDraft({ ...draft, total_amount: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Observações internas">
        <TextArea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      </Field>
      <Button type="submit" variant="secondary">
        <Save size={18} />
        Salvar ajuste
      </Button>
    </form>
  );
}

function InfoStat({ icon: Icon, label, value }) {
  const isMaterialIcon = typeof Icon === 'string';
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-md bg-mist text-leaf dark:bg-white/10 dark:text-blue-300">
        {isMaterialIcon ? <MaterialIcon name={Icon} size={20} /> : <Icon size={20} />}
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-ink/50 dark:text-white/55">{label}</p>
        <p className="text-lg font-black dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'text-lg font-black' : ''}`}>
      <span className="text-ink/65">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function FinanceCard({ icon: Icon, label, value }) {
  const isMaterialIcon = typeof Icon === 'string';
  return (
    <div className="rounded-md bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-mist text-leaf">
          {isMaterialIcon ? <MaterialIcon name={Icon} size={18} /> : <Icon size={18} />}
        </span>
        <span className="text-sm font-semibold text-ink/65">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function CalendarGrid({ availability, month }) {
  const days = buildCalendarDays(month);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const monthDays = days.filter((day) => day.getMonth() === month.getMonth());
  const unavailableDays = monthDays.filter((day) => availability.has(dateKey(day))).length;
  const availableDays = monthDays.length - unavailableDays;

  return (
    <div className="overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft dark:border-white/10 dark:bg-slate-900 dark:text-white">
      <div className="grid gap-4 border-b border-ink/10 px-4 py-4 dark:border-white/10 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-ink/50 dark:text-white/55">Calendário de disponibilidade</p>
          <h3 className="mt-1 text-2xl font-black capitalize">{format(month, "MMMM 'de' yyyy", { locale: ptBR })}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
          <span className="inline-flex items-center justify-center gap-2 rounded-md bg-leaf/10 px-3 py-2 font-bold text-leaf dark:bg-blue-400/15 dark:text-blue-200">
            <span className="h-2.5 w-2.5 rounded-sm bg-leaf dark:bg-blue-300" />
            {availableDays} livres
          </span>
          <span className="inline-flex items-center justify-center gap-2 rounded-md bg-coral/10 px-3 py-2 font-bold text-coral dark:bg-sky-400/15 dark:text-sky-200">
            <span className="h-2.5 w-2.5 rounded-sm bg-coral dark:bg-sky-300" />
            {unavailableDays} indisponíveis
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-ink/10 bg-mist text-center text-xs font-black uppercase tracking-wide text-ink/60 dark:border-white/10 dark:bg-white/10 dark:text-white/65">
        {weekDays.map((day) => (
          <div key={day} className="px-1 py-3 sm:px-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const availabilityItem = availability.get(dateKey(day));
          const unavailable = Boolean(availabilityItem);
          const outsideMonth = day.getMonth() !== month.getMonth();
          const today = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`calendar-cell border-b border-r border-ink/10 p-1.5 transition dark:border-white/10 sm:p-2 ${
                outsideMonth
                  ? 'bg-[#f8fbff] text-ink/30 dark:bg-slate-950 dark:text-white/30'
                  : unavailable
                    ? 'bg-sky-50 text-ink dark:bg-sky-950/30'
                    : 'bg-white hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex min-h-[72px] flex-col justify-between gap-2 sm:min-h-[84px]">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-md text-sm font-black ${
                    today ? 'bg-ink text-white dark:bg-white dark:text-ink' : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <span
                  className={`inline-flex min-h-7 items-center justify-center rounded-md px-1.5 py-1 text-center text-[10px] font-black leading-tight sm:px-2 sm:text-[11px] ${
                    unavailable
                      ? 'bg-coral text-white dark:bg-sky-500 dark:text-white'
                      : 'bg-leaf/10 text-leaf dark:bg-blue-400/15 dark:text-blue-200'
                  }`}
                  title={availabilityItem?.label || 'Livre'}
                >
                  {unavailable ? availabilityItem.label : 'Livre'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid gap-2 border-t border-ink/10 bg-[#f8fbff] px-4 py-3 text-xs font-semibold text-ink/65 dark:border-white/10 dark:bg-slate-950 dark:text-white/65 sm:flex sm:items-center sm:justify-between">
        <span>Check-out libera a data para nova entrada no mesmo dia.</span>
        <span>Use o Admin para criar bloqueios e manutenções.</span>
      </div>
    </div>
  );
}

function AdminPanel({
  addProperty,
  addPhoto,
  adminUnlocked,
  adminSession,
  cashMovements,
  deleteProperty,
  deletePhoto,
  financialSummary,
  interestRates,
  setInterestRates,
  saveInterestRates,
  suggestions,
  adminLogs,
  authProfile,
  onSignOut,
  addAdminLog,
  createManualReservation,
  createPaymentLink,
  reorderPhoto,
  onClose,
  onSelectProperty,
  onUnlock,
  properties,
  property,
  propertyLicense,
  propertyPaymentSettings,
  propertyPhotos,
  registerPayment,
  reservations,
  saveProperty,
  savePaymentSettings,
  updateReservationDetails,
  updateReservationStatus,
}) {
  const [login, setLogin] = useState({ email: adminEmail, password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [expandedReservationId, setExpandedReservationId] = useState('');
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [reportType, setReportType] = useState('summary');
  const [adminView, setAdminView] = useState('dashboard');
  const [adminNotice, setAdminNotice] = useState('');
  const [licenseNotice, setLicenseNotice] = useState('');
  const [adminUserNotice, setAdminUserNotice] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [adminDetails, setAdminDetails] = useState(() =>
    readLocalData('adminDetails', {
      full_name: authProfile?.full_name || 'Administrador',
      email: authProfile?.email || adminEmail,
      phone: authProfile?.phone || '',
      whatsapp: fallbackOwnerWhatsapp,
      role: normalizeRole(authProfile?.role) || 'proprietario',
    }),
  );
  const isOwnerAdmin = normalizeRole(authProfile?.role) === 'super_admin';
  const [manualReservation, setManualReservation] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    guests: 1,
    check_in: '',
    check_out: '',
    total_amount: 0,
    status: 'blocked',
    payment_method: 'cash',
    notes: '',
  });
  const [paymentDraft, setPaymentDraft] = useState({
    pix_key: '',
    pix_key_type: 'cpf',
    pix_receiver_name: '',
    bank_name: '',
    bank_agency: '',
    bank_account: '',
    bank_account_type: 'corrente',
    bank_holder: '',
    bank_document: '',
    card_payment_url: '',
    max_installments: 4,
    payment_instructions: '',
  });
  const [draft, setDraft] = useState({
    ...property,
    amenities: property.amenities?.join(', ') || '',
    rules: property.rules?.join('\n') || '',
  });
  const [newProperty, setNewProperty] = useState({
    ...emptyProperty,
    name: '',
    city: '',
    maps_url: '',
    headline: '',
    description: '',
    amenities: '',
    rules: '',
  });
  const [photo, setPhoto] = useState({ url: '', alt: '' });
  const [licenseDrafts, setLicenseDrafts] = useState(() =>
    Object.fromEntries(
      properties.map((item) => [
        item.id,
        {
          license_key: item.license_key || '',
          license_expires_at: item.license_expires_at || '',
          license_active: item.license_active !== false,
        },
      ]),
    ),
  );
  const visibleReservations = reservations.filter((reservation) => reservation.status !== 'cancelled');
  const pendingReservations = reservations.filter((reservation) => reservation.status === 'pending');
  const confirmedReservations = reservations.filter((reservation) => reservation.status === 'confirmed');
  const monthlyRevenue = useMemo(() => {
    const grouped = new Map();
    cashMovements
      .filter((movement) => movement.status === 'received')
      .forEach((movement) => {
        const key = String(movement.paid_at || movement.due_date || '').slice(0, 7) || 'Sem data';
        grouped.set(key, (grouped.get(key) || 0) + Number(movement.amount || 0));
      });
    const rows = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([monthKey, amount]) => ({ monthKey, amount }));
    const max = Math.max(...rows.map((row) => row.amount), 1);
    return rows.map((row) => ({ ...row, percentage: Math.max(8, Math.round((row.amount / max) * 100)) }));
  }, [cashMovements]);
  const adminMenu = [
    ['dashboard', 'Dashboard', 'dashboard'],
    ['houses', 'Casas', 'home_work'],
    ...(isOwnerAdmin ? [['licenses', 'Licenças', 'vpn_key']] : []),
    ['reservations', 'Reservas', 'calendar_month'],
    ['confirmations', 'Confirmações', 'fact_check'],
    ['cash', 'Caixa', 'account_balance_wallet'],
    ['reports', 'Relatórios', 'description'],
    ['clients', 'Clientes', 'groups'],
    ['admin', 'Dados do administrador', 'person'],
    ['settings', 'Configurações', 'settings'],
  ];
  const reportLabels = {
    summary: 'Resumo gerencial',
    reservations: 'Reservas',
    financial: 'Financeiro',
    occupancy: 'Ocupação e desempenho',
    guests: 'Hóspedes',
  };

  useEffect(() => {
    setDraft({
      ...property,
      amenities: property.amenities?.join(', ') || '',
      rules: property.rules?.join('\n') || '',
    });
    setPhoto({ url: '', alt: '' });
    setPaymentDraft({
      pix_key: propertyPaymentSettings?.pix_key || '',
      pix_key_type: propertyPaymentSettings?.pix_key_type || 'cpf',
      pix_receiver_name: propertyPaymentSettings?.pix_receiver_name || '',
      bank_name: propertyPaymentSettings?.bank_name || '',
      bank_agency: propertyPaymentSettings?.bank_agency || '',
      bank_account: propertyPaymentSettings?.bank_account || '',
      bank_account_type: propertyPaymentSettings?.bank_account_type || 'corrente',
      bank_holder: propertyPaymentSettings?.bank_holder || '',
      bank_document: propertyPaymentSettings?.bank_document || '',
      card_payment_url: propertyPaymentSettings?.card_payment_url || '',
      max_installments: propertyPaymentSettings?.max_installments || 4,
      payment_instructions: propertyPaymentSettings?.payment_instructions || '',
      id: propertyPaymentSettings?.id,
    });
  }, [property, propertyPaymentSettings]);

  useEffect(() => {
    setLicenseDrafts(
      Object.fromEntries(
        properties.map((item) => [
          item.id,
          {
            license_key: item.license_key || '',
            license_expires_at: item.license_expires_at || '',
            license_active: item.license_active !== false,
          },
        ]),
      ),
    );
  }, [properties]);

  useEffect(() => {
    if (adminView === 'admin') loadAdminUsers();
  }, [adminView]);

  async function loadAdminUsers() {
    if (!hasSupabaseConfig) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,phone,role')
      .order('email', { ascending: true });
    if (!error && data) setAdminUsers(data);
  }

  async function updateProfileRole(profile, role) {
    if (!isOwnerAdmin) {
      setAdminUserNotice('Somente o administrador principal pode alterar permissões.');
      return;
    }
    if (!hasSupabaseConfig || !profile?.id) return;
    const { error } = await supabase.from('profiles').update({ role }).eq('id', profile.id);
    if (error) {
      setAdminUserNotice('Não foi possível atualizar esse usuário. Confira as políticas RLS da tabela profiles.');
      return;
    }
    setAdminUsers((current) => current.map((item) => (item.id === profile.id ? { ...item, role } : item)));
    setAdminUserNotice(`${profile.email} atualizado para ${roleLabels[normalizeRole(role)] || role}.`);
  }

  async function submitSupabaseAdmin(event) {
    event.preventDefault();
    setAdminUserNotice('');
    if (!isOwnerAdmin) {
      setAdminUserNotice('Somente o administrador principal pode cadastrar outros administradores.');
      return;
    }
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) return;
    if (!hasSupabaseConfig) {
      setAdminUserNotice('Conecte o Supabase para cadastrar administradores reais.');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,phone,role')
      .eq('email', email)
      .maybeSingle();
    if (error) {
      setAdminUserNotice('Não foi possível buscar esse usuário no Supabase.');
      return;
    }
    if (!data) {
      setAdminUserNotice('Esse e-mail precisa criar conta ou entrar pelo Google/Facebook/Apple antes de virar admin.');
      return;
    }
    await updateProfileRole(data, 'proprietario');
    setNewAdminEmail('');
    loadAdminUsers();
  }

  async function submitLicense(event, propertyItem) {
    event.preventDefault();
    if (!isOwnerAdmin) {
      setLicenseNotice('Somente o administrador principal pode controlar licenças.');
      return;
    }
    const draftItem = licenseDrafts[propertyItem.id] || {};
    await saveProperty({
      ...propertyItem,
      license_key: draftItem.license_key || '',
      license_expires_at: draftItem.license_expires_at || '',
      license_active: draftItem.license_active !== false,
    });
    setLicenseNotice(`Licença de ${propertyItem.name} atualizada.`);
  }

  function submitProperty(event) {
    event.preventDefault();
    saveProperty({
      ...draft,
      daily_rate: Number(draft.daily_rate),
      cleaning_fee: Number(draft.cleaning_fee),
      max_guests: Number(draft.max_guests),
      bedrooms: Number(draft.bedrooms),
      bathrooms: Number(draft.bathrooms),
      amenities: parseAdminList(draft.amenities),
      rules: parseAdminList(draft.rules),
    });
  }

  function submitNewProperty(event) {
    event.preventDefault();
    addProperty({
      ...newProperty,
      daily_rate: Number(newProperty.daily_rate),
      cleaning_fee: Number(newProperty.cleaning_fee),
      max_guests: Number(newProperty.max_guests),
      bedrooms: Number(newProperty.bedrooms),
      bathrooms: Number(newProperty.bathrooms),
      amenities: parseAdminList(newProperty.amenities),
      rules: parseAdminList(newProperty.rules),
    });
    setNewProperty({
      ...emptyProperty,
      name: '',
      city: '',
      headline: '',
      description: '',
      maps_url: '',
      amenities: '',
      rules: '',
    });
    setShowNewProperty(false);
  }

  async function submitAdminDetails(event) {
    event.preventDefault();
    const normalizedDetails = {
      ...adminDetails,
      full_name: adminDetails.full_name || 'Administrador',
      email: adminDetails.email || adminEmail,
      role: normalizeRole(adminDetails.role || authProfile?.role) || 'proprietario',
    };
    setAdminDetails(normalizedDetails);
    writeLocalData('adminDetails', normalizedDetails);

    if (hasSupabaseConfig && adminSession?.user?.id) {
      await supabase.from('profiles').upsert({
        id: adminSession.user.id,
        email: normalizedDetails.email,
        full_name: normalizedDetails.full_name,
        phone: normalizedDetails.phone,
        role: normalizedDetails.role,
      });
    }

    setAdminNotice('Dados do administrador salvos.');
  }

  function startNewProperty() {
    setNewProperty({
      ...emptyProperty,
      name: '',
      city: '',
      headline: '',
      description: '',
      maps_url: '',
      amenities: '',
      rules: '',
    });
    setShowNewProperty(true);
  }

  function startEditProperty(propertyId) {
    onSelectProperty(propertyId);
    setShowNewProperty(false);
  }

  async function confirmReservation(reservation) {
    let preparedReservation = { ...reservation, status: 'confirmed' };
    if (['pix', 'card'].includes(reservation.payment_method) && !reservation.payment_url) {
      preparedReservation = await createPaymentLink(preparedReservation);
      if (preparedReservation.payment_url) {
        await updateReservationDetails(reservation.id, { payment_url: preparedReservation.payment_url });
      }
    }
    await updateReservationStatus(reservation.id, 'confirmed');
    const whatsAppUrl = buildWhatsAppUrl(
      reservation.guest_phone,
      buildGuestConfirmationMessage(property, preparedReservation, propertyPaymentSettings),
    );
    if (whatsAppUrl) window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
  }

  async function handlePhotoFiles(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    for (const file of files) {
      const alt = file.name.replace(/\.[^.]+$/, '');
      if (hasSupabaseConfig) {
        const storagePath = `${property.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '-')}`;
        const { error } = await supabase.storage.from('property-photos').upload(storagePath, file, {
          cacheControl: '31536000',
          upsert: false,
        });
        if (error) {
          const url = await fileToDataUrl(file);
          await addPhoto({ url, alt });
          continue;
        }
        const { data } = supabase.storage.from('property-photos').getPublicUrl(storagePath);
        await addPhoto({ url: data.publicUrl, alt, storage_path: storagePath });
      } else {
        const url = await fileToDataUrl(file);
        await addPhoto({ url, alt });
      }
    }
    event.target.value = '';
  }

  async function submitPhoto(event) {
    event.preventDefault();
    if (!photo.url.trim()) return;
    await addPhoto(photo);
    setPhoto({ url: '', alt: '' });
  }

  async function submitManualReservation(event) {
    event.preventDefault();
    const created = await createManualReservation(manualReservation);
    if (!created) return;
    setManualReservation({
      guest_name: '',
      guest_email: '',
      guest_phone: '',
      guests: 1,
      check_in: '',
      check_out: '',
      total_amount: 0,
      status: 'blocked',
      payment_method: 'cash',
      notes: '',
    });
  }

  async function confirmCancellation() {
    if (!cancelTarget) return;
    await updateReservationStatus(cancelTarget.id, 'cancelled');
    await addAdminLog('reservation_cancelled', {
      reservation_id: cancelTarget.id,
      guest_name: cancelTarget.guest_name,
      property_id: cancelTarget.property_id,
    });
    setCancelTarget(null);
  }

  function generateReportPdf() {
    const doc = new jsPDF();
    const activeReservations = visibleReservations.filter((reservation) => reservation.status !== 'cancelled');
    const confirmedReservations = activeReservations.filter((reservation) => reservation.status === 'confirmed');
    const nightsBooked = confirmedReservations.reduce((sum, reservation) => {
      const nights = Math.max(0, differenceInCalendarDays(toDate(reservation.check_out), toDate(reservation.check_in)));
      return sum + nights;
    }, 0);
    const totalRevenue = activeReservations.reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);
    const received = cashMovements
      .filter((movement) => movement.status === 'received')
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const occupancy = Math.round((nightsBooked / 365) * 100);
    const adr = nightsBooked ? totalRevenue / nightsBooked : 0;
    const title = reportLabels[reportType];
    const reportDate = format(new Date(), 'dd/MM/yyyy HH:mm');

    const sectionsByType = {
      summary: [
        {
          heading: 'Indicadores',
          rows: [
            ['Reservas ativas', activeReservations.length],
            ['Reservas confirmadas', confirmedReservations.length],
            ['Noites confirmadas', nightsBooked],
            ['Receita prevista', currency.format(totalRevenue)],
            ['Recebido', currency.format(received)],
            ['A receber', currency.format(Math.max(0, totalRevenue - received))],
            ['Ocupacao estimada no ano', `${occupancy}%`],
            ['Diaria media estimada', currency.format(adr)],
          ],
        },
      ],
      reservations: [
        {
          heading: 'Reservas',
          rows: activeReservations.map((reservation) => [
            reservation.guest_name || '-',
            `${reservation.check_in} ate ${reservation.check_out}`,
            reservation.status || '-',
            paymentLabels[reservation.payment_method] || 'A combinar',
            currency.format(reservation.total_amount || 0),
          ]),
        },
      ],
      financial: [
        {
          heading: 'Resumo financeiro',
          rows: [
            ['Receita prevista', currency.format(totalRevenue)],
            ['Recebido', currency.format(received)],
            ['A receber', currency.format(Math.max(0, totalRevenue - received))],
            ['Previsao geral', currency.format(financialSummary.forecast)],
          ],
        },
        {
          heading: 'Lancamentos',
          rows: cashMovements.map((movement) => [
            movement.due_date || '-',
            movement.description || 'Lancamento',
            movement.status || '-',
            paymentLabels[movement.payment_method] || movement.payment_method || '-',
            currency.format(movement.amount || 0),
          ]),
        },
      ],
      occupancy: [
        {
          heading: 'Ocupacao e desempenho',
          rows: [
            ['Noites confirmadas', nightsBooked],
            ['Ocupacao estimada no ano', `${occupancy}%`],
            ['Diaria media estimada', currency.format(adr)],
            ['Receita por noite disponivel', currency.format(totalRevenue / 365)],
          ],
        },
      ],
      guests: [
        {
          heading: 'Hospedes',
          rows: activeReservations.map((reservation) => [
            reservation.guest_name || '-',
            reservation.guest_phone || '-',
            reservation.guest_email || '-',
            reservation.guest_document || '-',
          ]),
        },
      ],
    };

    function addHeader() {
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(title, 14, 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`${property.name} | Emitido em ${reportDate}`, 14, 22);
      doc.setTextColor(15, 23, 42);
    }

    function ensureSpace(currentY, height = 10) {
      if (currentY + height <= 285) return currentY;
      doc.addPage();
      addHeader();
      return 42;
    }

    function addKeyValueRows(rows, startY) {
      let y = startY;
      rows.forEach(([label, value]) => {
        y = ensureSpace(y, 8);
        doc.setFont('helvetica', 'bold');
        doc.text(String(label), 14, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), 82, y);
        y += 8;
      });
      return y;
    }

    function addReportRows(rows, startY) {
      let y = startY;
      if (!rows.length) {
        doc.text('Nenhum dado disponivel para este relatorio.', 14, y);
        return y + 8;
      }

      rows.forEach((row) => {
        const line = Array.isArray(row) ? row.join(' | ') : String(row);
        const wrapped = doc.splitTextToSize(line, 182);
        y = ensureSpace(y, wrapped.length * 6 + 4);
        doc.text(wrapped, 14, y);
        y += wrapped.length * 6 + 3;
      });
      return y;
    }

    addHeader();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Dados da casa', 14, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let y = addKeyValueRows(
      [
        ['Casa', property.name],
        ['Cidade', property.city],
        ['Diaria', currency.format(property.daily_rate || 0)],
        ['Taxa de limpeza', currency.format(property.cleaning_fee || 0)],
        ['Hospedes maximos', property.max_guests || '-'],
        ['Google Maps', normalizeExternalUrl(property.maps_url) || 'Nao informado'],
      ],
      52,
    );

    sectionsByType[reportType].forEach((section) => {
      y = ensureSpace(y + 6, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(section.heading, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      y += 8;
      const isKeyValue = section.rows.every((row) => Array.isArray(row) && row.length === 2);
      y = isKeyValue ? addKeyValueRows(section.rows, y) : addReportRows(section.rows, y);
    });

    doc.save(`${property.name}-${reportType}.pdf`.replace(/\s+/g, '-').toLowerCase());
  }

  function generateReportCsv() {
    const activeReservations = visibleReservations.filter((reservation) => reservation.status !== 'cancelled');
    const rowsByType = {
      summary: [
        ['Indicador', 'Valor'],
        ['Casa', property.name],
        ['Reservas ativas', activeReservations.length],
        ['Reservas confirmadas', activeReservations.filter((reservation) => reservation.status === 'confirmed').length],
        ['Recebido', financialSummary.received],
        ['A receber', financialSummary.receivable],
        ['Previsão', financialSummary.forecast],
      ],
      reservations: [
        ['Cliente', 'E-mail', 'Telefone', 'Check-in', 'Check-out', 'Status', 'Pagamento', 'Total'],
        ...activeReservations.map((reservation) => [
          reservation.guest_name || '',
          reservation.guest_email || '',
          reservation.guest_phone || '',
          reservation.check_in || '',
          reservation.check_out || '',
          reservationStatusLabels[reservation.status] || reservation.status || '',
          paymentLabels[reservation.payment_method] || reservation.payment_method || '',
          Number(reservation.total_amount || 0),
        ]),
      ],
      financial: [
        ['Data', 'Descrição', 'Status', 'Método', 'Valor'],
        ...cashMovements.map((movement) => [
          movement.due_date || '',
          movement.description || '',
          movement.status || '',
          paymentLabels[movement.payment_method] || movement.payment_method || '',
          Number(movement.amount || 0),
        ]),
      ],
      occupancy: [
        ['Reserva', 'Check-in', 'Check-out', 'Noites', 'Status'],
        ...activeReservations.map((reservation) => [
          reservation.guest_name || '',
          reservation.check_in || '',
          reservation.check_out || '',
          getReservationNights(reservation),
          reservationStatusLabels[reservation.status] || reservation.status || '',
        ]),
      ],
      guests: [
        ['Nome', 'Telefone', 'E-mail', 'Documento'],
        ...activeReservations.map((reservation) => [
          reservation.guest_name || '',
          reservation.guest_phone || '',
          reservation.guest_email || '',
          reservation.guest_document || '',
        ]),
      ],
    };
    const csv = rowsByType[reportType].map((row) => row.map(csvCell).join(';')).join('\n');
    downloadTextFile(
      `${property.name}-${reportType}.csv`.replace(/\s+/g, '-').toLowerCase(),
      `\ufeff${csv}`,
      'text/csv;charset=utf-8',
    );
  }

  function generateReportPdfLegacy() {
    const doc = new jsPDF();
    const activeReservations = visibleReservations.filter((reservation) => reservation.status !== 'cancelled');
    const confirmedReservations = activeReservations.filter((reservation) => reservation.status === 'confirmed');
    const nightsBooked = confirmedReservations.reduce((sum, reservation) => {
      const nights = Math.max(0, differenceInCalendarDays(toDate(reservation.check_out), toDate(reservation.check_in)));
      return sum + nights;
    }, 0);
    const totalRevenue = activeReservations.reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);
    const received = cashMovements
      .filter((movement) => movement.status === 'received')
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const occupancy = Math.round((nightsBooked / 365) * 100);
    const adr = nightsBooked ? totalRevenue / nightsBooked : 0;

    const linesByType = {
      summary: [
        `Casa: ${property.name}`,
        `Reservas ativas: ${activeReservations.length}`,
        `Reservas confirmadas: ${confirmedReservations.length}`,
        `Noites confirmadas: ${nightsBooked}`,
        `Receita prevista: ${currency.format(totalRevenue)}`,
        `Recebido: ${currency.format(received)}`,
        `Ocupação estimada no ano: ${occupancy}%`,
        `Diária média estimada: ${currency.format(adr)}`,
      ],
      reservations: activeReservations.map(
        (reservation) =>
          `${reservation.guest_name} | ${reservation.check_in} até ${reservation.check_out} | ${reservation.status} | ${currency.format(reservation.total_amount || 0)}`,
      ),
      financial: [
        `Receita prevista: ${currency.format(totalRevenue)}`,
        `Recebido: ${currency.format(received)}`,
        `A receber: ${currency.format(Math.max(0, totalRevenue - received))}`,
        '',
        ...cashMovements.map(
          (movement) =>
            `${movement.due_date} | ${movement.description || 'Lançamento'} | ${movement.status} | ${currency.format(movement.amount || 0)}`,
        ),
      ],
      occupancy: [
        `Noites confirmadas: ${nightsBooked}`,
        `Ocupação estimada no ano: ${occupancy}%`,
        `Diária média estimada: ${currency.format(adr)}`,
        `Receita por noite disponível: ${currency.format(totalRevenue / 365)}`,
      ],
      guests: activeReservations.map(
        (reservation) =>
          `${reservation.guest_name} | ${reservation.guest_phone || '-'} | ${reservation.guest_email || '-'} | ${reservation.guest_document || '-'}`,
      ),
    };

    const title = reportLabels[reportType];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title, 14, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Emitido em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${property.name}`, 14, 26);

    let y = 40;
    const rows = linesByType[reportType].length ? linesByType[reportType] : ['Nenhum dado disponível para este relatório.'];
    rows.forEach((line) => {
      const wrapped = doc.splitTextToSize(line || ' ', 180);
      if (y + wrapped.length * 6 > 285) {
        doc.addPage();
        y = 18;
      }
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6 + 2;
    });

    doc.save(`${property.name}-${reportType}.pdf`.replace(/\s+/g, '-').toLowerCase());
  }

  const ownerPanelBlocked =
    adminUnlocked &&
    normalizeRole(authProfile?.role) !== 'super_admin' &&
    propertyLicense &&
    ['expired', 'suspended'].includes(normalizeLicenseStatus(propertyLicense));

  if (ownerPanelBlocked) {
    return (
      <div className="fixed inset-0 z-40 bg-ink/55 p-3 backdrop-blur-sm">
        <div className="ml-auto h-full max-w-3xl overflow-auto rounded-md bg-[#f4f8ff] shadow-soft">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/15 bg-leaf px-5 py-4 text-white">
            <div>
              <h2 className="text-2xl font-black">Administração</h2>
              <p className="text-sm text-white/75">Acesso temporariamente bloqueado.</p>
            </div>
            <Button variant="outline" onClick={onClose} aria-label="Fechar painel">
              <X size={18} />
            </Button>
          </div>
          <div className="grid h-[calc(100%-76px)] place-items-center p-5">
            <div className="max-w-lg rounded-md border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 shrink-0" />
                <div>
                  <h3 className="text-2xl font-black">Licença {licenseStatusLabels[normalizeLicenseStatus(propertyLicense)]}</h3>
                  <p className="mt-2 text-sm leading-6">
                    O painel do proprietário está bloqueado até a regularização da licença. As reservas públicas também ficam pausadas
                    quando a licença está vencida ou suspensa.
                  </p>
                  <p className="mt-3 text-sm font-bold">Vencimento: {propertyLicense.expires_at || '-'}</p>
                </div>
              </div>
              <Button className="mt-5" type="button" variant="secondary" onClick={onClose}>
                Entendi
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/55 p-2 backdrop-blur-sm sm:p-4">
      <div className="ml-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-md bg-[#f4f8ff] text-ink shadow-soft">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/15 bg-leaf px-5 py-4 text-white">
          <div>
            <h2 className="text-2xl font-black">Administração</h2>
            <p className="text-sm text-white/75">Atualize valores, fotos e reservas.</p>
          </div>
          <Button variant="outline" onClick={onClose} aria-label="Fechar painel">
            <X size={18} />
          </Button>
        </div>

        {!adminUnlocked ? (
          <form
            className="grid gap-4 p-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setLoginError('');
              setLoginNotice('');

              if (
                canUsePasswordAdmin &&
                isPrivilegedEmail(login.email.trim()) &&
                login.password === adminPassword
              ) {
                onUnlock();
                return;
              }

              if (hasSupabaseConfig) {
                const nextLogin = { email: login.email.trim(), password: login.password };
                const { data, error } = await supabase.auth.signInWithPassword(nextLogin);
                if (error?.message === 'Email not confirmed') {
                  setLoginError('E-mail ainda nao confirmado.');
                  setLoginNotice(
                    'Abra o e-mail de confirmação do Supabase. Se o link deu erro, confira a URL do site no Supabase Auth.',
                  );
                  return;
                }
                if (error) setLoginError('Login nao autorizado. Confira e-mail e senha.');
                if (data?.user && !['proprietario', 'super_admin'].includes(getAuthRole(null, data.user.email))) {
                  await supabase.auth.signOut();
                  setLoginError('Este e-mail não tem permissão de proprietário.');
                }
                return;
              }

              if (!canUsePasswordAdmin) {
                setLoginError('Admin indisponivel sem senha configurada.');
                setLoginNotice('Configure VITE_ADMIN_PASSWORD na Vercel ou Supabase Auth para proteger o painel.');
                return;
              }

              setLoginError('Login nao autorizado. Confira e-mail e senha.');
            }}
          >
            <Field label="E-mail do administrador">
              <TextInput
                type="email"
                value={login.email}
                onChange={(event) => setLogin({ ...login, email: event.target.value })}
                placeholder={adminEmail}
                autoComplete="username"
              />
            </Field>
            <Field label="Senha">
              <TextInput
                type="password"
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </Field>
            {!hasSupabaseConfig ? null : (
              <p className="text-xs font-semibold text-ink/55">Administrador autorizado: {adminEmail}</p>
            )}
            <Button type="submit">
              <Lock size={18} />
              Entrar
            </Button>
            {loginError ? <p className="text-sm font-semibold text-red-700">{loginError}</p> : null}
            {loginNotice ? <p className="text-sm leading-6 text-ink/70">{loginNotice}</p> : null}
            {hasSupabaseConfig && login.email ? (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  setLoginError('');
                  setLoginNotice('');
                  const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email: login.email,
                    options: {
                      emailRedirectTo: window.location.origin,
                    },
                  });
                  if (error) {
                    setLoginError('Não foi possível reenviar agora.');
                    return;
                  }
                  setLoginNotice('Novo e-mail de confirmação enviado.');
                }}
              >
                Reenviar confirmação
              </Button>
            ) : null}
            <p className="text-sm leading-6 text-ink/65">
              {hasSupabaseConfig
                ? 'Use o usuário administrador criado no Supabase Auth para administrar o site.'
                : 'Use a senha administrativa configurada na Vercel. Sem Supabase, os dados ficam salvos neste navegador.'}
            </p>
          </form>
        ) : (
          <div className="grid min-h-0 flex-1 gap-5 overflow-auto p-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:p-5">
            <aside className="h-fit rounded-md bg-white p-3 shadow-sm lg:sticky lg:top-0">
              <div className="mb-3 rounded-md bg-[#f4f8ff] p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/50">Painel</p>
                <p className="mt-1 text-sm font-black">{adminDetails.full_name || authProfile?.full_name || 'Administrador'}</p>
                <p className="mt-1 truncate text-xs font-semibold text-ink/55">{adminDetails.email || authProfile?.email || adminEmail}</p>
              </div>
              <nav className="grid gap-1">
                {adminMenu.map(([key, label, icon]) => (
                  <button
                    key={key}
                    type="button"
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-black transition ${
                      adminView === key ? 'bg-ink text-white' : 'hover:bg-mist'
                    }`}
                    onClick={() => setAdminView(key)}
                  >
                    <MaterialIcon name={icon} size={18} />
                    {label}
                  </button>
                ))}
              </nav>
            </aside>
            <div className="grid min-w-0 gap-5">
            {adminSession ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold">Logado como {adminSession.user.email}</p>
                <Button variant="outline" onClick={onSignOut}>
                  Sair
                </Button>
              </div>
            ) : null}
            {normalizeRole(authProfile?.role) !== 'super_admin' && propertyLicense && ['expired', 'suspended'].includes(normalizeLicenseStatus(propertyLicense)) ? (
              <section className="grid gap-3 rounded-md border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 shrink-0" />
                  <div>
                    <h3 className="text-xl font-black">Licença indisponível</h3>
                    <p className="mt-1 text-sm leading-6">
                      Seu painel está temporariamente bloqueado porque a licença está {licenseStatusLabels[normalizeLicenseStatus(propertyLicense)]?.toLowerCase()}.
                      Entre em contato com o suporte para regularizar o acesso.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
            {adminView === 'dashboard' ? (
              <section className="grid gap-5 rounded-md bg-white p-4 shadow-sm">
                <div>
                  <h3 className="text-xl font-black">Dashboard</h3>
                  <p className="mt-1 text-sm text-ink/65">Visão geral operacional da casa selecionada.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <FinanceCard icon="home_work" label="Casas" value={properties.length} />
                  <FinanceCard icon="event_available" label="Reservas ativas" value={visibleReservations.length} />
                  <FinanceCard icon="pending_actions" label="Pendentes" value={pendingReservations.length} />
                  <FinanceCard icon="account_balance_wallet" label="Recebido" value={currency.format(financialSummary.received)} />
                </div>
              </section>
            ) : null}
            <section className={`${adminView === 'houses' ? 'grid' : 'hidden'} gap-4 rounded-md bg-white p-4 shadow-sm`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">Minhas casas</h3>
                  <p className="mt-1 text-sm text-ink/65">
                    Cadastre uma casa por vez ou edite uma casa existente.
                  </p>
                </div>
                <button
                  type="button"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-700 text-2xl font-black leading-none text-white shadow-[0_16px_34px_rgba(37,99,235,0.36)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(37,99,235,0.44)]"
                  onClick={() => {
                    if (showNewProperty) {
                      setShowNewProperty(false);
                    } else {
                      startNewProperty();
                    }
                  }}
                  aria-label={showNewProperty ? 'Cancelar cadastro de casa' : 'Cadastrar nova casa'}
                >
                  {showNewProperty ? <X size={22} /> : <Plus size={22} />}
                </button>
              </div>
              <div className="grid gap-2">
                {properties.map((item) => (
                  <div
                    key={item.id}
                    className={`grid gap-3 rounded-xl border px-3 py-3 shadow-sm transition duration-200 sm:grid-cols-[1fr_auto] sm:items-center ${
                      item.id === property.id
                        ? 'border-blue-300 bg-gradient-to-r from-blue-50 to-sky-100'
                        : 'border-ink/10 bg-white hover:border-blue-200 hover:bg-mist'
                    }`}
                  >
                    <button type="button" className="text-left" onClick={() => startEditProperty(item.id)}>
                      <span className="block text-xs font-black">{item.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-semibold text-ink/60">{item.city}</span>
                    </button>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        type="button"
                        variant={item.id === property.id && !showNewProperty ? 'secondary' : 'outline'}
                        className="px-3"
                        onClick={() => startEditProperty(item.id)}
                        aria-label={`Editar ${item.name}`}
                      >
                        <Pencil size={16} />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="px-3"
                        onClick={() => deleteProperty(item.id)}
                        disabled={properties.length <= 1}
                        aria-label={`Excluir ${item.name}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {showNewProperty && adminView === 'houses' ? (
              <form className="grid gap-4 rounded-md border border-leaf/20 bg-white p-4 shadow-sm" onSubmit={submitNewProperty}>
                <h3 className="text-xl font-black">Cadastrar nova casa</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome">
                    <TextInput
                      value={newProperty.name}
                      onChange={(event) => setNewProperty({ ...newProperty, name: event.target.value })}
                      placeholder="Casa do Lago"
                      required
                    />
                  </Field>
                  <Field label="Cidade">
                    <TextInput
                      value={newProperty.city}
                      onChange={(event) => setNewProperty({ ...newProperty, city: event.target.value })}
                      placeholder="Cidade, UF"
                      required
                    />
                  </Field>
                  <Field label="Link do Google Maps">
                    <TextInput
                      type="text"
                      value={newProperty.maps_url || ''}
                      onChange={(event) => setNewProperty({ ...newProperty, maps_url: event.target.value })}
                      placeholder="https://maps.google.com/..."
                    />
                  </Field>
                  <Field label="Cor da página">
                    <div className="flex items-center gap-3 rounded-xl border border-ink/15 bg-white px-3 py-2 shadow-sm">
                      <input
                        type="color"
                        value={newProperty.theme_color || '#2563eb'}
                        onChange={(event) => setNewProperty({ ...newProperty, theme_color: event.target.value })}
                        className="h-9 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0"
                      />
                      <TextInput
                        value={newProperty.theme_color || '#2563eb'}
                        onChange={(event) => setNewProperty({ ...newProperty, theme_color: event.target.value })}
                        placeholder="#2563eb"
                      />
                    </div>
                  </Field>
                  <Field label="Diária">
                    <TextInput
                      type="number"
                      value={newProperty.daily_rate}
                      onChange={(event) => setNewProperty({ ...newProperty, daily_rate: event.target.value })}
                    />
                  </Field>
                  <Field label="Taxa de limpeza">
                    <TextInput
                      type="number"
                      value={newProperty.cleaning_fee}
                      onChange={(event) => setNewProperty({ ...newProperty, cleaning_fee: event.target.value })}
                    />
                  </Field>
                  <Field label="Hóspedes máximos">
                    <TextInput
                      type="number"
                      value={newProperty.max_guests}
                      onChange={(event) => setNewProperty({ ...newProperty, max_guests: event.target.value })}
                    />
                  </Field>
                  <Field label="Quartos">
                    <TextInput
                      type="number"
                      value={newProperty.bedrooms}
                      onChange={(event) => setNewProperty({ ...newProperty, bedrooms: event.target.value })}
                    />
                  </Field>
                  <Field label="Banheiros">
                    <TextInput
                      type="number"
                      value={newProperty.bathrooms}
                      onChange={(event) => setNewProperty({ ...newProperty, bathrooms: event.target.value })}
                    />
                  </Field>
                  <Field label="WhatsApp do proprietário">
                    <TextInput
                      value={newProperty.owner_whatsapp}
                      onChange={(event) => setNewProperty({ ...newProperty, owner_whatsapp: event.target.value })}
                      placeholder={fallbackOwnerWhatsapp}
                    />
                  </Field>
                  <Field label="E-mail do proprietário">
                    <TextInput
                      type="email"
                      value={newProperty.owner_email || ''}
                      onChange={(event) => setNewProperty({ ...newProperty, owner_email: event.target.value })}
                      placeholder={fallbackOwnerEmail}
                    />
                  </Field>
                </div>
                <Field label="Chamada">
                  <TextInput
                    value={newProperty.headline}
                    onChange={(event) => setNewProperty({ ...newProperty, headline: event.target.value })}
                    placeholder="Resumo curto da casa"
                    required
                  />
                </Field>
                <Field label="Descrição">
                  <TextArea
                    value={newProperty.description}
                    onChange={(event) => setNewProperty({ ...newProperty, description: event.target.value })}
                    placeholder="Detalhes para o cliente"
                    required
                  />
                </Field>
                <Field label="Comodidades separadas por vírgula">
                  <TextInput
                    value={newProperty.amenities}
                    onChange={(event) => setNewProperty({ ...newProperty, amenities: event.target.value })}
                    placeholder="Wi-Fi, Churrasqueira, Piscina"
                  />
                </Field>
              <Field label="Condições da locação, uma por linha">
                  <TextArea
                    value={newProperty.rules}
                    onChange={(event) => setNewProperty({ ...newProperty, rules: event.target.value })}
                    placeholder="Cancelamento com no mínimo 2 meses de antecedência, retenção de 50% em cancelamentos em cima da hora"
                  />
                </Field>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowNewProperty(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="secondary">
                    <DoorOpen size={18} />
                    Cadastrar casa
                  </Button>
                </div>
              </form>
            ) : null}

            {adminView === 'licenses' && isOwnerAdmin ? (
              <section className="grid gap-4">
                <div className="rounded-md bg-white p-4 shadow-sm">
                  <h3 className="text-xl font-black">Licenças de uso</h3>
                  <p className="mt-1 text-sm text-ink/65">
                    Controle as mensalidades do sistema vendidas para cada administrador de casa.
                  </p>
                </div>
                {licenseNotice ? (
                  <p className="rounded-md bg-leaf/10 px-4 py-3 text-sm font-bold text-leaf">{licenseNotice}</p>
                ) : null}
                {properties.map((item) => {
                  const licenseDraft = licenseDrafts[item.id] || {};
                  const valid = isLicenseValid({ ...item, ...licenseDraft });
                  return (
                    <form
                      key={item.id}
                      className="grid gap-4 rounded-md bg-white p-4 shadow-sm"
                      onSubmit={(event) => submitLicense(event, item)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-black">{item.name}</h4>
                          <p className="mt-1 text-sm text-ink/65">{item.city || 'Casa cadastrada'}</p>
                        </div>
                        <span
                          className={`rounded-md px-3 py-2 text-xs font-black ${
                            valid ? 'bg-leaf/10 text-leaf' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {valid ? 'Ativa' : 'Pausada'}
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Chave de licença">
                          <TextInput
                            value={licenseDraft.license_key || ''}
                            onChange={(event) =>
                              setLicenseDrafts((current) => ({
                                ...current,
                                [item.id]: { ...licenseDraft, license_key: event.target.value },
                              }))
                            }
                            placeholder="CASA-YPE-2026-001"
                          />
                        </Field>
                        <Field label="Vencimento">
                          <TextInput
                            type="date"
                            value={licenseDraft.license_expires_at || ''}
                            onChange={(event) =>
                              setLicenseDrafts((current) => ({
                                ...current,
                                [item.id]: { ...licenseDraft, license_expires_at: event.target.value },
                              }))
                            }
                          />
                        </Field>
                      </div>
                      <label className="flex items-center gap-3 rounded-md bg-[#f4f8ff] px-3 py-3 text-sm font-bold text-ink">
                        <input
                          type="checkbox"
                          checked={licenseDraft.license_active !== false}
                          onChange={(event) =>
                            setLicenseDrafts((current) => ({
                              ...current,
                              [item.id]: { ...licenseDraft, license_active: event.target.checked },
                            }))
                          }
                          className="h-5 w-5 rounded border-ink/20"
                        />
                        Licença mensal paga e ativa para este administrador de casa
                      </label>
                      <div className="flex justify-end">
                        <Button type="submit">
                          <Save size={18} />
                          Salvar licença
                        </Button>
                      </div>
                    </form>
                  );
                })}
              </section>
            ) : null}

            <section className={`${adminView === 'cash' ? 'grid' : 'hidden'} gap-4 rounded-md bg-white p-4 shadow-sm`}>
              <div>
                <h3 className="text-xl font-black">Caixa</h3>
                <p className="mt-1 text-sm text-ink/65">Acompanhe o que entrou e o que ainda tem para receber.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <FinanceCard icon={Banknote} label="Recebido" value={currency.format(financialSummary.received)} />
                <FinanceCard icon={CreditCard} label="A receber" value={currency.format(financialSummary.receivable)} />
                <FinanceCard icon={CalendarDays} label="Previsão" value={currency.format(financialSummary.forecast)} />
              </div>
              <div className="rounded-md bg-white p-4 shadow-sm">
                <p className="text-sm font-black">Faturamento mensal</p>
                {monthlyRevenue.length ? (
                  <div className="mt-4 grid gap-3">
                    {monthlyRevenue.map((row) => (
                      <div key={row.monthKey} className="grid gap-2 sm:grid-cols-[80px_1fr_120px] sm:items-center">
                        <span className="text-xs font-bold text-ink/55">{row.monthKey}</span>
                        <div className="h-3 overflow-hidden rounded-full bg-mist">
                          <div className="h-full rounded-full bg-leaf" style={{ width: `${row.percentage}%` }} />
                        </div>
                        <span className="text-sm font-black sm:text-right">{currency.format(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-ink/60">Sem recebimentos para montar o gráfico.</p>
                )}
              </div>
              <div className="grid gap-2 rounded-md bg-white p-4 shadow-sm">
                <p className="text-sm font-black">Últimos lançamentos</p>
                {cashMovements.length ? (
                  cashMovements.slice(0, 5).map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-ink/70">{movement.description}</span>
                      <span className="font-bold">{currency.format(movement.amount || 0)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink/60">Nenhum recebimento registrado ainda.</p>
                )}
              </div>
            </section>

            <section className={`${adminView === 'reports' ? 'grid' : 'hidden'} gap-4 rounded-md bg-white p-4 shadow-sm`}>
              <div>
                <h3 className="text-xl font-black">Relatórios</h3>
                <p className="mt-1 text-sm text-ink/65">
                  Emita PDFs com reservas, financeiro, ocupação e hóspedes da casa selecionada.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Tipo de relatório">
                  <SelectInput value={reportType} onChange={(event) => setReportType(event.target.value)}>
                    {Object.entries(reportLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="flex flex-wrap items-end gap-2">
                  <Button type="button" onClick={generateReportPdf}>
                    <Save size={18} />
                    Emitir PDF
                  </Button>
                  <Button type="button" variant="outline" onClick={generateReportCsv}>
                    <FileText size={18} />
                    Exportar Excel
                  </Button>
                </div>
              </div>
            </section>

            <form className={`${adminView === 'houses' && !showNewProperty ? 'grid' : 'hidden'} gap-4 rounded-md bg-white p-4 shadow-sm`} onSubmit={submitProperty}>
              <h3 className="text-xl font-black">Dados da casa</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome">
                  <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </Field>
                <Field label="Cidade">
                  <TextInput value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
                </Field>
                <Field label="Link do Google Maps">
                  <TextInput
                    type="text"
                    value={draft.maps_url || ''}
                    onChange={(event) => setDraft({ ...draft, maps_url: event.target.value })}
                    placeholder="https://maps.google.com/..."
                  />
                </Field>
                <Field label="Cor da página">
                  <div className="flex items-center gap-3 rounded-xl border border-ink/15 bg-white px-3 py-2 shadow-sm">
                    <input
                      type="color"
                      value={draft.theme_color || '#2563eb'}
                      onChange={(event) => setDraft({ ...draft, theme_color: event.target.value })}
                      className="h-9 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0"
                    />
                    <TextInput
                      value={draft.theme_color || '#2563eb'}
                      onChange={(event) => setDraft({ ...draft, theme_color: event.target.value })}
                      placeholder="#2563eb"
                    />
                  </div>
                </Field>
                <Field label="WhatsApp do proprietário">
                  <TextInput
                    value={draft.owner_whatsapp || ''}
                    onChange={(event) => setDraft({ ...draft, owner_whatsapp: event.target.value })}
                    placeholder={fallbackOwnerWhatsapp}
                  />
                </Field>
                <Field label="E-mail do proprietário">
                  <TextInput
                    type="email"
                    value={draft.owner_email || ''}
                    onChange={(event) => setDraft({ ...draft, owner_email: event.target.value })}
                    placeholder={fallbackOwnerEmail}
                  />
                </Field>
                <Field label="Diária">
                  <TextInput
                    type="number"
                    value={draft.daily_rate}
                    onChange={(event) => setDraft({ ...draft, daily_rate: event.target.value })}
                  />
                </Field>
                <Field label="Taxa de limpeza">
                  <TextInput
                    type="number"
                    value={draft.cleaning_fee}
                    onChange={(event) => setDraft({ ...draft, cleaning_fee: event.target.value })}
                  />
                </Field>
                <Field label="Hóspedes máximos">
                  <TextInput
                    type="number"
                    value={draft.max_guests}
                    onChange={(event) => setDraft({ ...draft, max_guests: event.target.value })}
                  />
                </Field>
                <Field label="Quartos">
                  <TextInput
                    type="number"
                    value={draft.bedrooms}
                    onChange={(event) => setDraft({ ...draft, bedrooms: event.target.value })}
                  />
                </Field>
                <Field label="Banheiros">
                  <TextInput
                    type="number"
                    value={draft.bathrooms}
                    onChange={(event) => setDraft({ ...draft, bathrooms: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="Chamada">
                <TextArea
                  value={draft.headline}
                  onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
                />
              </Field>
              <Field label="Descrição">
                <TextArea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
              <Field label="Comodidades separadas por vírgula">
                <TextInput
                  value={draft.amenities}
                  onChange={(event) => setDraft({ ...draft, amenities: event.target.value })}
                />
              </Field>
                <Field label="Condições da locação, uma por linha">
                <TextArea
                  value={draft.rules}
                  onChange={(event) => setDraft({ ...draft, rules: event.target.value })}
                  placeholder="Ex: cancelamento com no mínimo 2 meses de antecedência"
                />
              </Field>
              <Button type="submit">
                <Save size={18} />
                Salvar dados
              </Button>
            </form>

            <form
              className={`${adminView === 'houses' && !showNewProperty ? 'grid' : 'hidden'} gap-4 rounded-md bg-white p-4 shadow-sm`}
              onSubmit={submitPhoto}
            >
              <h3 className="text-xl font-black">Fotos da casa</h3>
              <Field label="Selecionar imagens do celular ou computador">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoFiles}
                  className="rounded-md border border-ink/15 bg-white px-3 py-3 text-sm text-ink shadow-sm file:mr-4 file:rounded-md file:border-0 file:bg-mist file:px-4 file:py-2 file:font-bold file:text-ink"
                />
              </Field>
              <Field label="URL da foto">
                <TextInput
                  value={photo.url}
                  onChange={(event) => setPhoto({ ...photo, url: event.target.value })}
                  placeholder="https://..."
                  required
                />
              </Field>
              <Field label="Descrição da foto">
                <TextInput
                  value={photo.alt}
                  onChange={(event) => setPhoto({ ...photo, alt: event.target.value })}
                  placeholder="Sala, quarto, fachada..."
                />
              </Field>
              <Button type="submit" variant="secondary">
                <ImagePlus size={18} />
                Adicionar por URL
              </Button>
              {propertyPhotos.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {propertyPhotos.map((item) => (
                    <div key={item.id} className="grid gap-2 rounded-md border border-ink/10 bg-[#f4f8ff] p-3">
                      <img className="h-32 w-full rounded-md object-cover" src={item.url} alt={item.alt || 'Foto da casa'} />
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-ink/70">{item.alt || 'Foto sem descrição'}</span>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={() => reorderPhoto(item.id, -1)} aria-label="Mover foto para cima">
                            <ChevronLeft size={16} />
                          </Button>
                          <Button type="button" variant="outline" onClick={() => reorderPhoto(item.id, 1)} aria-label="Mover foto para baixo">
                            <ChevronRight size={16} />
                          </Button>
                          <Button type="button" variant="outline" onClick={() => deletePhoto(item.id)} aria-label="Excluir foto">
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                      {item.sort_order === 1 ? <span className="text-xs font-black text-leaf">Imagem principal</span> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold text-ink/60">Nenhuma foto cadastrada ainda.</p>
              )}
            </form>

            {adminView === 'reservations' ? (
              <form className="grid gap-4 rounded-md bg-white p-4 shadow-sm" onSubmit={submitManualReservation}>
                <div>
                  <h3 className="text-xl font-black">Reserva manual e bloqueio de datas</h3>
                  <p className="mt-1 text-sm text-ink/65">Use para reservas fora do site, manutenção ou indisponibilidade.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome/identificação">
                    <TextInput
                      value={manualReservation.guest_name}
                      onChange={(event) => setManualReservation({ ...manualReservation, guest_name: event.target.value })}
                      placeholder="Reserva manual"
                    />
                  </Field>
                  <Field label="Status">
                    <SelectInput
                      value={manualReservation.status}
                      onChange={(event) => setManualReservation({ ...manualReservation, status: event.target.value })}
                    >
                      <option value="pending">Pendente</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="blocked">Bloqueado manualmente</option>
                      <option value="maintenance">Manutenção</option>
                    </SelectInput>
                  </Field>
                  <Field label="Check-in">
                    <TextInput
                      type="date"
                      value={manualReservation.check_in}
                      onChange={(event) => setManualReservation({ ...manualReservation, check_in: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Check-out">
                    <TextInput
                      type="date"
                      value={manualReservation.check_out}
                      onChange={(event) => setManualReservation({ ...manualReservation, check_out: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Hóspedes">
                    <TextInput
                      type="number"
                      min="1"
                      value={manualReservation.guests}
                      onChange={(event) => setManualReservation({ ...manualReservation, guests: event.target.value })}
                    />
                  </Field>
                  <Field label="Valor">
                    <TextInput
                      type="number"
                      value={manualReservation.total_amount}
                      onChange={(event) => setManualReservation({ ...manualReservation, total_amount: event.target.value })}
                    />
                  </Field>
                  <Field label="Pagamento">
                    <SelectInput
                      value={manualReservation.payment_method}
                      onChange={(event) => setManualReservation({ ...manualReservation, payment_method: event.target.value })}
                    >
                      <option value="pix">Pix</option>
                      <option value="card">Cartão</option>
                      <option value="transfer">Transferência</option>
                      <option value="cash">Dinheiro</option>
                      <option value="check">Cheque</option>
                    </SelectInput>
                  </Field>
                </div>
                <Field label="Observações internas">
                  <TextArea
                    value={manualReservation.notes}
                    onChange={(event) => setManualReservation({ ...manualReservation, notes: event.target.value })}
                    placeholder="Origem da reserva, motivo do bloqueio ou detalhes internos"
                  />
                </Field>
                <Button type="submit" variant="secondary">
                  <CalendarDays size={18} />
                  Criar reserva manual
                </Button>
              </form>
            ) : null}

            <section className={`${['reservations', 'confirmations'].includes(adminView) ? 'block' : 'hidden'} rounded-md bg-white p-4 shadow-sm`}>
              <h3 className="text-xl font-black">Reservas</h3>
              <div className="mt-4 grid gap-3">
                {visibleReservations.length ? (
                  visibleReservations.map((reservation) => {
                    const expanded = expandedReservationId === reservation.id;
                    return (
                      <div
                        key={reservation.id}
                        className="cursor-pointer rounded-md bg-white p-4 shadow-sm transition hover:bg-mist"
                        onClick={() => setExpandedReservationId(expanded ? '' : reservation.id)}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black">{reservation.guest_name}</p>
                        <p className="text-sm text-ink/65">
                          {reservation.check_in} até {reservation.check_out} - {reservation.guests} hóspede(s)
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {currency.format(reservation.total_amount || 0)} - {reservation.status}
                        </p>
                        <p className="mt-1 text-sm text-ink/65">
                          {paymentLabels[reservation.payment_method] || 'A combinar'} -{' '}
                          {reservation.payment_status === 'paid' ? 'pago' : 'a receber'}
                        </p>
                        <p className="mt-1 text-sm text-ink/65">
                          {reservation.guest_phone || reservation.guest_email}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {reservation.guest_phone ? (
                          <a
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                            href={buildWhatsAppUrl(
                              reservation.guest_phone,
                              `Ola, ${reservation.guest_name}. Estou falando sobre sua solicitacao de reserva em ${property.name}.`,
                            )}
                            onClick={(event) => event.stopPropagation()}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle size={16} />
                            WhatsApp
                          </a>
                        ) : null}
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            confirmReservation(reservation);
                          }}
                        >
                          <Check size={16} />
                          Confirmar
                        </Button>
                        {reservation.payment_status !== 'paid' ? (
                          <Button
                            variant="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              registerPayment(reservation, 'paid');
                            }}
                          >
                            <Banknote size={16} />
                            Recebido
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setCancelTarget(reservation);
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                    {expanded ? (
                      <div className="mt-4 grid gap-2 border-t border-ink/10 pt-4 text-sm text-ink/75">
                        <p><strong>E-mail:</strong> {reservation.guest_email || '-'}</p>
                        <p><strong>Telefone:</strong> {reservation.guest_phone || '-'}</p>
                        <p><strong>Documento:</strong> {reservation.guest_document || '-'}</p>
                        <p><strong>Hóspedes:</strong> {reservation.guests}</p>
                        <p><strong>Pagamento:</strong> {paymentLabels[reservation.payment_method] || 'A combinar'}</p>
                        <p><strong>Total:</strong> {currency.format(reservation.total_amount || 0)}</p>
                        <p><strong>Observações:</strong> {reservation.notes || '-'}</p>
                        {reservation.source === 'manual' ? (
                          <ManualReservationEditor reservation={reservation} onSave={updateReservationDetails} />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                    );
                  })
                ) : (
                  <p className="rounded-md bg-white p-4 text-sm font-semibold text-ink/60 shadow-sm">
                    Nenhuma reserva ativa para esta casa.
                  </p>
                )}
              </div>
            </section>
            {adminView === 'clients' ? (
              <section className="grid gap-4 rounded-md bg-white p-4 shadow-sm">
                <h3 className="text-xl font-black">Clientes</h3>
                <div className="grid gap-3">
                  {Array.from(new Map(reservations.map((reservation) => [reservation.guest_email, reservation])).values())
                    .filter((reservation) => reservation.guest_email)
                    .map((reservation) => (
                      <div key={reservation.guest_email} className="rounded-md border border-ink/10 p-4">
                        <p className="font-black">{reservation.guest_name}</p>
                        <p className="text-sm text-ink/65">{reservation.guest_email}</p>
                        <p className="mt-1 text-sm text-ink/65">{reservation.guest_phone || '-'}</p>
                      </div>
                    ))}
                </div>
              </section>
            ) : null}

            {adminView === 'admin' ? (
              <section className="grid gap-4">
                <form className="grid gap-4 rounded-md bg-white p-4 shadow-sm" onSubmit={submitAdminDetails}>
                  <div>
                    <h3 className="text-xl font-black">Dados do administrador</h3>
                    <p className="mt-1 text-sm text-ink/65">
                      Atualize os dados exibidos no painel e no perfil administrativo.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nome">
                      <TextInput
                        value={adminDetails.full_name || ''}
                        onChange={(event) => setAdminDetails({ ...adminDetails, full_name: event.target.value })}
                        placeholder="Administrador"
                      />
                    </Field>
                    <Field label="E-mail">
                      <TextInput
                        type="email"
                        value={adminDetails.email || ''}
                        onChange={(event) => setAdminDetails({ ...adminDetails, email: event.target.value })}
                        placeholder={adminEmail}
                      />
                    </Field>
                    <Field label="Telefone">
                      <TextInput
                        value={adminDetails.phone || ''}
                        onChange={(event) => setAdminDetails({ ...adminDetails, phone: event.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </Field>
                    <Field label="WhatsApp">
                      <TextInput
                        value={adminDetails.whatsapp || ''}
                        onChange={(event) => setAdminDetails({ ...adminDetails, whatsapp: event.target.value })}
                        placeholder={fallbackOwnerWhatsapp}
                      />
                    </Field>
                  </div>
                  <div className="rounded-md bg-[#f4f8ff] p-3 text-sm leading-6 text-ink/70">
                    <strong>Perfil:</strong> {roleLabels[normalizeRole(adminDetails.role || authProfile?.role)] || 'Proprietário'}. O e-mail de acesso continua
                    dependendo dos administradores autorizados na configuração do site.
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {adminNotice ? <p className="text-sm font-semibold text-leaf">{adminNotice}</p> : <span />}
                    <Button type="submit">
                      <Save size={18} />
                      Salvar administrador
                    </Button>
                  </div>
                </form>

                {isOwnerAdmin ? (
                <div className="grid gap-4 rounded-md bg-white p-4 shadow-sm">
                  <div>
                    <h3 className="text-xl font-black">Administradores Supabase</h3>
                    <p className="mt-1 text-sm text-ink/65">
                      Primeiro o usuário precisa existir no Supabase Auth; depois promova o perfil dele para proprietário.
                    </p>
                  </div>
                  <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={submitSupabaseAdmin}>
                    <Field label="E-mail do novo administrador">
                      <TextInput
                        type="email"
                        value={newAdminEmail}
                        onChange={(event) => setNewAdminEmail(event.target.value)}
                        placeholder="admin@email.com"
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button type="submit" className="w-full">
                        <UserPlus size={18} />
                        Tornar proprietário
                      </Button>
                    </div>
                  </form>
                  {adminUserNotice ? <p className="text-sm font-semibold text-ink/70">{adminUserNotice}</p> : null}
                  <div className="grid gap-2">
                    {adminUsers.length ? (
                      adminUsers.map((profile) => (
                        <div
                          key={profile.id}
                          className="grid gap-3 rounded-md border border-ink/10 bg-[#f4f8ff] p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <div>
                            <p className="font-black">{profile.full_name || profile.email}</p>
                            <p className="text-sm text-ink/65">{profile.email}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-ink/50">
                              {roleLabels[normalizeRole(profile.role)] || profile.role || 'hospede'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <Button
                              type="button"
                              variant={normalizeRole(profile.role) === 'proprietario' ? 'secondary' : 'outline'}
                              onClick={() => updateProfileRole(profile, 'proprietario')}
                            >
                              Proprietário
                            </Button>
                            <Button
                              type="button"
                              variant={normalizeRole(profile.role) === 'hospede' ? 'secondary' : 'outline'}
                              onClick={() => updateProfileRole(profile, 'hospede')}
                            >
                              Hóspede
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-md bg-[#f4f8ff] p-3 text-sm text-ink/65">
                        Nenhum perfil carregado. No modo local, use o e-mail admin configurado no .env.
                      </p>
                    )}
                  </div>
                </div>
                ) : null}

                <div className="grid gap-2 rounded-md bg-white p-4 shadow-sm">
                  <p className="font-black">Logs recentes</p>
                  {adminLogs.length ? (
                    adminLogs.slice(0, 6).map((log) => (
                      <div key={log.id || log.created_at} className="rounded-md bg-[#f4f8ff] p-3 text-sm">
                        <strong>{log.action}</strong> - {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ink/60">Nenhum log registrado ainda.</p>
                  )}
                </div>
              </section>
            ) : null}

            {adminView === 'settings' ? (
              <section className="grid gap-4 rounded-md bg-white p-4 shadow-sm">
                <h3 className="text-xl font-black">Configurações</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {interestRates.map((item, index) => (
                    <Field key={item.installments} label={`${item.installments}x - juros (%)`}>
                      <TextInput
                        type="number"
                        value={item.rate}
                        onChange={(event) =>
                          setInterestRates((current) =>
                            current.map((rate, rateIndex) =>
                              rateIndex === index ? { ...rate, rate: Number(event.target.value) } : rate,
                            ),
                          )
                        }
                      />
                    </Field>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => saveInterestRates(interestRates)}>
                    <Save size={18} />
                    Salvar juros
                  </Button>
                </div>
                <form
                  className="grid gap-4 rounded-md bg-[#f4f8ff] p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    savePaymentSettings(paymentDraft);
                  }}
                >
                  <div>
                    <h4 className="font-black">Configurações financeiras do proprietário</h4>
                    <p className="mt-1 text-sm text-ink/65">Esses dados entram automaticamente na confirmação enviada ao hóspede.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Chave Pix">
                      <TextInput value={paymentDraft.pix_key} onChange={(event) => setPaymentDraft({ ...paymentDraft, pix_key: event.target.value })} />
                    </Field>
                    <Field label="Tipo da chave Pix">
                      <SelectInput value={paymentDraft.pix_key_type} onChange={(event) => setPaymentDraft({ ...paymentDraft, pix_key_type: event.target.value })}>
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                        <option value="email">E-mail</option>
                        <option value="phone">Telefone</option>
                        <option value="random">Aleatória</option>
                      </SelectInput>
                    </Field>
                    <Field label="Nome do recebedor">
                      <TextInput
                        value={paymentDraft.pix_receiver_name}
                        onChange={(event) => setPaymentDraft({ ...paymentDraft, pix_receiver_name: event.target.value })}
                      />
                    </Field>
                    <Field label="Banco">
                      <TextInput value={paymentDraft.bank_name} onChange={(event) => setPaymentDraft({ ...paymentDraft, bank_name: event.target.value })} />
                    </Field>
                    <Field label="Agência">
                      <TextInput value={paymentDraft.bank_agency} onChange={(event) => setPaymentDraft({ ...paymentDraft, bank_agency: event.target.value })} />
                    </Field>
                    <Field label="Conta">
                      <TextInput value={paymentDraft.bank_account} onChange={(event) => setPaymentDraft({ ...paymentDraft, bank_account: event.target.value })} />
                    </Field>
                    <Field label="Tipo de conta">
                      <SelectInput
                        value={paymentDraft.bank_account_type}
                        onChange={(event) => setPaymentDraft({ ...paymentDraft, bank_account_type: event.target.value })}
                      >
                        <option value="corrente">Corrente</option>
                        <option value="poupanca">Poupança</option>
                        <option value="pagamento">Pagamento</option>
                      </SelectInput>
                    </Field>
                    <Field label="Titular">
                      <TextInput value={paymentDraft.bank_holder} onChange={(event) => setPaymentDraft({ ...paymentDraft, bank_holder: event.target.value })} />
                    </Field>
                    <Field label="CPF/CNPJ">
                      <TextInput value={paymentDraft.bank_document} onChange={(event) => setPaymentDraft({ ...paymentDraft, bank_document: event.target.value })} />
                    </Field>
                    <Field label="Link de pagamento cartão">
                      <TextInput
                        value={paymentDraft.card_payment_url}
                        onChange={(event) => setPaymentDraft({ ...paymentDraft, card_payment_url: event.target.value })}
                        placeholder="https://..."
                      />
                    </Field>
                    <Field label="Máximo de parcelas">
                      <TextInput
                        type="number"
                        min="1"
                        value={paymentDraft.max_installments}
                        onChange={(event) => setPaymentDraft({ ...paymentDraft, max_installments: event.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Instruções de pagamento">
                    <TextArea
                      value={paymentDraft.payment_instructions}
                      onChange={(event) => setPaymentDraft({ ...paymentDraft, payment_instructions: event.target.value })}
                    />
                  </Field>
                  <Button type="submit" variant="secondary">
                    <Save size={18} />
                    Salvar dados financeiros
                  </Button>
                </form>
                <div className="rounded-md bg-[#f4f8ff] p-4">
                  <p className="font-black">Sugestões recebidas</p>
                  <div className="mt-3 grid gap-2">
                    {suggestions.slice(0, 5).map((suggestion) => (
                      <p key={suggestion.id} className="rounded-md bg-white p-3 text-sm shadow-sm">
                        {suggestion.message}
                      </p>
                    ))}
                    {!suggestions.length ? <p className="text-sm text-ink/60">Nenhuma sugestão ainda.</p> : null}
                  </div>
                </div>
              </section>
            ) : null}
            {cancelTarget ? (
              <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur">
                <div className="w-full max-w-md rounded-md bg-white p-5 text-ink shadow-soft">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-1 text-red-600" />
                    <div>
                      <h3 className="text-xl font-black">Cancelar reserva</h3>
                      <p className="mt-2 text-sm leading-6 text-ink/70">
                        Tem certeza que deseja cancelar esta reserva?
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>
                      Voltar
                    </Button>
                    <Button type="button" variant="secondary" onClick={confirmCancellation}>
                      Confirmar cancelamento
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
