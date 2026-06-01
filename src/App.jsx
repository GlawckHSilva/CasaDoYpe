import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Bath,
  BedDouble,
  Building2,
  Banknote,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Check,
  ChartColumnIncreasing,
  CircleUserRound,
  ClipboardList,
  Copy,
  CreditCard,
  DoorOpen,
  Eye,
  FileText,
  Home,
  Headset,
  ImagePlus,
  Instagram,
  KeyRound,
  LifeBuoy,
  Lightbulb,
  Link2,
  Lock,
  LogOut,
  Logs,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  Trash2,
  Twitter,
  UtensilsCrossed,
  User,
  UserPlus,
  Users,
  Wallet,
  Waves,
  Wifi,
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
import AuthGuard from './components/AuthGuard.jsx';
import LoadingState from './components/LoadingState.jsx';
import { roleHomePath as getRoleHomePath, canAccessRoute } from './routes/authRoutes.js';
import { hasSupabaseConfig, supabase, supabaseConfig } from './services/supabaseClient.js';
import { canUseDemoFallback, getInitialThemeMode, readLocalData, writeLocalData } from './services/storageService.js';
import { createPropertyRecord, deletePropertyRecord, updatePropertyRecord } from './services/propertyService.js';
import { createReservationRecord } from './services/reservationService.js';
import { deleteLicenseRecord, getOwnerPanelAccessState, upsertLicenseRecord } from './services/licenseService.js';
import NavbarShell from './components/Navbar.jsx';
import UserMenu from './components/UserMenu.jsx';
import HomePage from './pages/Home.jsx';
import CasasPage from './pages/Casas.jsx';
import CasaDetalhePage from './pages/CasaDetalhe.jsx';
import LoginPage from './pages/Login.jsx';
import AdminDashboardPage from './pages/AdminDashboard.jsx';
import SuperAdminDashboardPage from './pages/SuperAdminDashboard.jsx';
import HospedePortalPage from './pages/HospedePortal.jsx';

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
const passwordRecoveryRedirect =
  import.meta.env.VITE_PASSWORD_RECOVERY_REDIRECT || 'https://casa-do-ype.vercel.app/reset-password';
const socialLinks = {
  instagram: import.meta.env.VITE_SOCIAL_INSTAGRAM || 'https://www.instagram.com/hospedex',
  email: `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(commercialEmail)}`,
  twitter: import.meta.env.VITE_SOCIAL_X || 'https://x.com/hospedex',
};
const useDemoFallback = canUseDemoFallback(hasSupabaseConfig);
const brandAssets = {
  horizontal: '/brand/hospedex-logo.png',
  vertical: '/brand/hospedex-logo.png',
  mark: '/brand/hospedex-logo.png',
  white: '/brand/hospedex-logo.png',
  blue: '/brand/hospedex-logo.png',
};
const panelIconMap = {
  dashboard: BarChart3,
  calendar_month: CalendarDays,
  event_available: CalendarDays,
  pending_actions: ClipboardList,
  task_alt: Check,
  cancel: X,
  support_agent: Headset,
  settings: Settings,
  person: CircleUserRound,
  manage_accounts: CircleUserRound,
  admin_panel_settings: Users,
  group: Users,
  groups: Users,
  verified_user: ShieldCheck,
  home_work: Home,
  account_balance_wallet: Wallet,
  payments: ChartColumnIncreasing,
  description: FileText,
  vpn_key: KeyRound,
  forum: Lightbulb,
  image: ImagePlus,
  refresh: RefreshCw,
  warning: AlertTriangle,
  mail: Mail,
  redeem: BadgeDollarSign,
  logout: LogOut,
  lock: Lock,
  person_add: UserPlus,
  close: X,
};
const amenityIconRules = [
  [/wi-?fi|internet/, Wifi],
  [/piscina|pool/, Waves],
  [/churrasqueira|barbecue|grelha/, UtensilsCrossed],
  [/estacionamento|garagem|vaga|carro/, Car],
  [/ar condicionado|climatiza|ventila|split/, Snowflake],
  [/quarto|cama|suite|suíte/, BedDouble],
  [/banheiro|banho/, Bath],
  [/hospede|hóspede|pessoa|grupo/, Users],
  [/diaria|diária|valor|preco|preço/, Wallet],
];
const existingAccountMessage = 'Este email ja esta cadastrado.';
const authRequestTimeoutMs = 8000;
const profileRequestTimeoutMs = 3500;
const paymentLabels = {
  pix: 'Pix',
  card: 'Cartão',
  transfer: 'Transferência',
  cash: 'Dinheiro',
  check: 'Cheque',
};

const paymentStatusLabels = {
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Reembolsado',
  not_required: 'Nao aplicavel',
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
  cancelled: 'Cancelada',
  blocked: 'Bloqueada',
  inactive: 'Inativa',
};

const planCards = [
  {
    id: 'mensal',
    title: 'Mensal',
    price: 89,
    period: '/mes',
    savings: 'Flexivel para comecar',
    propertyLimit: 1,
    highlighted: false,
    benefits: ['1 propriedade ativa', 'Reservas online', 'Painel financeiro', 'Suporte essencial'],
  },
  {
    id: 'semestral',
    title: 'Semestral',
    price: 449,
    period: '/semestre',
    savings: 'Economia de 15%',
    propertyLimit: 3,
    highlighted: true,
    benefits: ['Ate 3 propriedades', 'Calendario e reservas', 'Financeiro completo', 'Prioridade no suporte'],
  },
  {
    id: 'anual',
    title: 'Anual',
    price: 799,
    period: '/ano',
    savings: 'Economia de 25%',
    propertyLimit: 8,
    highlighted: false,
    benefits: ['Ate 8 propriedades', 'Licencas centralizadas', 'Relatorios e caixa', 'Preparado para pagamentos'],
  },
];

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
  id: '',
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
  active: true,
  license_key: '',
  license_expires_at: '',
  license_active: true,
  rules: [],
  amenities: [],
};

const emptyPublicProperty = {
  ...emptyProperty,
  id: 'empty-property',
  name: 'Hospedagem indisponível',
  city: '',
  headline: 'Esta hospedagem ainda não foi publicada.',
  description: 'Volte em instantes ou veja outras hospedagens disponíveis.',
  license_active: false,
};

const placeholderPhoto = {
  id: 'placeholder-photo',
  url:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#e8eef7"/><path d="M160 580h880L820 350 650 500 540 390z" fill="#b7c4d8"/><circle cx="410" cy="260" r="70" fill="#f7b267"/><text x="600" y="690" text-anchor="middle" font-family="Arial" font-size="42" fill="#506176">Sem foto cadastrada</text></svg>',
    ),
  alt: 'Sem foto cadastrada',
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

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getAmenityIcon(label) {
  const normalized = normalizeSearchText(label);
  return amenityIconRules.find(([pattern]) => pattern.test(normalized))?.[1] || Check;
}

function ensurePropertySlug(property, existing = []) {
  const base = slugify(property?.slug || property?.name || property?.city || 'hospedagem') || 'hospedagem';
  const taken = new Set(existing.filter(Boolean).map((item) => item.slug).filter((slug) => slug && slug !== property?.slug));
  let slug = base;
  let suffix = 2;
  while (taken.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return { ...property, slug };
}

function propertyPath(property) {
  return `/casas/${property?.slug || slugify(property?.name || property?.id)}`;
}

function getPrimaryPhoto(property, photos) {
  return (
    photos
      .filter((photo) => photo.property_id === property?.id)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.sort_order || 0) - (b.sort_order || 0))[0] || null
  );
}

async function safeSupabaseQuery(query, timeoutMs = 12000, timeoutMessage = 'Consulta inicial excedeu o tempo limite.') {
  let timerId;
  const timeout = new Promise((resolve) => {
    timerId = setTimeout(() => resolve({ data: null, error: new Error(timeoutMessage) }), timeoutMs);
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

function buildOwnerNotificationUrl({ property, reservation, nights }) {
  const body = buildReservationMessage({ property, reservation, nights });
  return buildWhatsAppUrl(property.owner_whatsapp || fallbackOwnerWhatsapp, body);
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

function getLicenseDaysUntilExpires(license) {
  if (!license?.expires_at) return null;
  const expiresAt = toDate(license.expires_at);
  if (!expiresAt) return null;
  return differenceInCalendarDays(expiresAt, new Date());
}

function isLicenseAccessValid(license) {
  if (!license) return false;
  const status = String(license.status || '').toLowerCase();
  const daysUntilExpires = getLicenseDaysUntilExpires(license);
  const startsAt = license.starts_at ? toDate(license.starts_at) : null;
  const alreadyStarted = !startsAt || differenceInCalendarDays(startsAt, new Date()) <= 0;
  return ['active', 'trial'].includes(status) && alreadyStarted && (daysUntilExpires === null || daysUntilExpires >= 0);
}

function compareLicenseRecency(a, b) {
  return String(b?.expires_at || b?.updated_at || b?.created_at || '').localeCompare(
    String(a?.expires_at || a?.updated_at || a?.created_at || ''),
  );
}

function getLatestOwnerLicense(licenses, ownerId) {
  if (!ownerId) return null;
  const ownerLicenses = licenses.filter((license) => license.owner_id === ownerId);
  const validLicense = ownerLicenses.filter(isLicenseAccessValid).sort(compareLicenseRecency)[0];
  return validLicense || ownerLicenses.sort(compareLicenseRecency)[0] || null;
}

function getRelevantPropertyLicense(licenses, property) {
  const directLicenses = licenses.filter((license) => license.property_id === property?.id);
  const directValid = directLicenses.filter(isLicenseAccessValid).sort(compareLicenseRecency)[0];
  if (directValid) return directValid;
  const ownerLicense = getLatestOwnerLicense(licenses, property?.owner_id);
  return ownerLicense || directLicenses.sort(compareLicenseRecency)[0] || null;
}

function isLicenseValid(property) {
  if (property.active === false) return false;
  if (property.license_active === false) return false;
  if (!property.license_expires_at) return true;
  const expiresAt = toDate(property.license_expires_at);
  if (!expiresAt) return true;
  return !isBefore(addDays(expiresAt, 1), new Date());
}

function isPropertyPubliclyVisible(property, licenses = []) {
  if (!property || property.id === 'empty-property' || property.active === false) return false;
  const relevantLicense = getRelevantPropertyLicense(licenses, property);
  if (relevantLicense) return isLicenseAccessValid(relevantLicense);
  return isLicenseValid(property);
}

function buildLicenseWarningText(license) {
  const days = getLicenseDaysUntilExpires(license);
  if (days === null) return '';
  if (days < 0) return 'Sua licenca esta vencida.';
  if (days === 0) return 'Sua licenca vence hoje.';
  if (days === 1) return 'Sua licenca vence amanha.';
  if (days <= 7) return `Sua licenca vence em ${days} dias.`;
  return '';
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
  return getRoleHomePath(normalizeRole(role));
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
  const daysUntilExpires = getLicenseDaysUntilExpires(license);
  return daysUntilExpires !== null && daysUntilExpires < 0;
}

function normalizeLicenseStatus(license) {
  if (!license) return 'expired';
  if (isLicenseExpired(license)) return 'expired';
  return license.status || 'active';
}

function isAdminEmail(email) {
  const normalized = String(email || '').toLowerCase();
  return normalized === adminEmail.toLowerCase() || adminEmailAliases.includes(normalized);
}

function isPrivilegedEmail(email) {
  return isSuperAdminEmail(email) || isAdminEmail(email);
}

function isExistingAccountError(error) {
  return /already|registered|exists|user_already_exists|email_exists|ja tem cadastro|já tem cadastro/i.test(error?.message || '');
}

function isExistingAccountResponse(data) {
  return Boolean(data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
}

function getPasswordRecoveryRedirect() {
  return passwordRecoveryRedirect;
}

function isPasswordRecoveryUrl() {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  return (
    url.pathname === '/reset-password' ||
    url.pathname === '/resetar-senha' ||
    url.searchParams.get('type') === 'recovery' ||
    url.searchParams.get('recovery') === '1' ||
    hash.get('type') === 'recovery'
  );
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

function PanelIcon({ icon, className = '', size = 18 }) {
  if (typeof icon === 'function' || (typeof icon === 'object' && icon?.$$typeof)) {
    const Icon = icon;
    return <Icon className={className} size={size} aria-hidden="true" />;
  }
  const Icon = panelIconMap[icon];
  if (Icon) return <Icon className={className} size={size} aria-hidden="true" />;
  return <MaterialIcon name={String(icon || '')} className={className} size={size} />;
}

function BrandLogo({ variant = 'horizontal', className = 'h-10 w-auto', alt = 'Hospedex' }) {
  return <img className={`aspect-square object-contain ${className}`} src={brandAssets[variant] || brandAssets.horizontal} alt={alt} />;
}

function LoadingScreen({ label = 'Carregando Hospedex...' }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f8fb] p-6 text-ink">
      <div className="grid justify-items-center gap-4 text-center">
        <BrandLogo variant="vertical" className="h-40 w-40 rounded-2xl shadow-soft" />
        <div className="h-1.5 w-44 overflow-hidden rounded-full bg-blue-100">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-leaf" />
        </div>
        <p className="text-sm font-bold text-ink/60">{label}</p>
      </div>
    </div>
  );
}

function Button({ children, className = '', variant = 'primary', ...props }) {
  const variants = {
    primary: 'btn-primary-theme',
    secondary: 'btn-secondary-theme',
    ghost:
      'bg-white/90 text-ink shadow-[0_10px_24px_rgba(255,255,255,0.18)] backdrop-blur hover:bg-white',
    outline:
      'border border-blue-200 bg-white text-ink shadow-sm hover:border-blue-300 hover:bg-blue-50',
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-bold transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 ${variants[variant]} ${className}`}
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
  const [properties, setProperties] = useState(() => (useDemoFallback ? readLocalData('properties', demoProperties) : []));
  const [selectedPropertyId, setSelectedPropertyId] = useState(() => (useDemoFallback ? readLocalData('selectedPropertyId', demoProperty.id) : ''));
  const [photos, setPhotos] = useState(() => (useDemoFallback ? readLocalData('photos', demoPhotos) : []));
  const [reservations, setReservations] = useState(() => (useDemoFallback ? readLocalData('reservations', demoReservations) : []));
  const [cashMovements, setCashMovements] = useState(() => (useDemoFallback ? readLocalData('cashMovements', []) : []));
  const [suggestions, setSuggestions] = useState(() => (useDemoFallback ? readLocalData('suggestions', []) : []));
  const [supportTickets, setSupportTickets] = useState(() => (useDemoFallback ? readLocalData('supportTickets', []) : []));
  const [homeBanners, setHomeBanners] = useState(() => (useDemoFallback ? readLocalData('homeBanners', []) : []));
  const [adminLogs, setAdminLogs] = useState(() => (useDemoFallback ? readLocalData('adminLogs', []) : []));
  const [interestRates, setInterestRates] = useState(() => (useDemoFallback ? readLocalData('interestRates', defaultInterestRates) : defaultInterestRates));
  const [profiles, setProfiles] = useState(() => (useDemoFallback ? readLocalData('profiles', []) : []));
  const [licenses, setLicenses] = useState(() => (useDemoFallback ? readLocalData('licenses', []) : []));
  const [licenseHistory, setLicenseHistory] = useState(() => (useDemoFallback ? readLocalData('licenseHistory', []) : []));
  const [paymentSettings, setPaymentSettings] = useState(() => (useDemoFallback ? readLocalData('paymentSettings', []) : []));
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);
  const [route, setRoute] = useState(() => (typeof window === 'undefined' ? '/' : window.location.pathname || '/'));
  const [month, setMonth] = useState(new Date());
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminSession, setAdminSession] = useState(null);
  const [authProfile, setAuthProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(!hasSupabaseConfig);
  const [publicDataChecked, setPublicDataChecked] = useState(!hasSupabaseConfig);
  const [authOpen, setAuthOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState('login');
  const [adminInitialView, setAdminInitialView] = useState('dashboard');
  const [clientPortalInitialView, setClientPortalInitialView] = useState('dashboard');
  const [superAdminInitialView, setSuperAdminInitialView] = useState('dashboard');
  const [passwordRecoveryOpen, setPasswordRecoveryOpen] = useState(() => isPasswordRecoveryUrl());
  const [clientPortalOpen, setClientPortalOpen] = useState(false);
  const [themeMode, setThemeMode] = useState(getInitialThemeMode);
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

  const routeSlug = route.match(/^\/casas\/([^/?#]+)/)?.[1] ? decodeURIComponent(route.match(/^\/casas\/([^/?#]+)/)?.[1]) : '';
  const publicProperties = useMemo(
    () => properties.filter((item) => isPropertyPubliclyVisible(item, licenses)),
    [properties, licenses],
  );
  const routeProperty = routeSlug
    ? properties.find((item) => item.slug === routeSlug || slugify(item.name) === routeSlug || item.id === routeSlug)
    : null;
  const property =
    routeProperty ||
    properties.find((item) => item.id === selectedPropertyId) ||
    publicProperties[0] ||
    properties[0] ||
    emptyPublicProperty;
  const propertyLicense = useMemo(
    () => getRelevantPropertyLicense(licenses, property),
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
  const adminProperty =
    adminProperties.find((item) => item.id === property.id) ||
    adminProperties[0] ||
    (authProfile
      ? { ...emptyProperty, id: 'empty-owner-property', name: 'Nenhuma casa cadastrada', owner_id: authProfile.id, owner_email: authProfile.email }
      : property);
  const adminPropertyPaymentSettings =
    paymentSettings.find((setting) => setting.property_id === adminProperty.id) ||
    paymentSettings.find((setting) => setting.owner_id && setting.owner_id === adminProperty.owner_id) ||
    null;
  const adminPropertyLicense = getRelevantPropertyLicense(licenses, adminProperty);
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
  const selectedPhotoData = propertyPhotos[selectedPhoto] || propertyPhotos[0] || placeholderPhoto;
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
  const canViewRouteProperty =
    !routeProperty ||
    isPropertyPubliclyVisible(routeProperty, licenses) ||
    normalizeRole(authProfile?.role) === 'super_admin' ||
    routeProperty.owner_id === authProfile?.id;

  async function loadSupabaseData() {
    if (!hasSupabaseConfig) {
      setPublicDataChecked(true);
      return;
    }

    try {
      const [
        { data: propertyRows },
        { data: photoRows },
        { data: reservationRows },
        { data: movementRows },
        { data: interestRows },
        profileResult,
        { data: licenseRows },
        { data: licenseHistoryRows },
        { data: paymentSettingRows },
        { data: suggestionRows },
        { data: supportTicketRows },
        { data: homeBannerRows },
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
          safeSupabaseQuery(supabase.from('suggestions').select('*').order('created_at', { ascending: false })),
          safeSupabaseQuery(supabase.from('support_tickets').select('*').order('created_at', { ascending: false })),
          safeSupabaseQuery(supabase.from('home_banners').select('*').order('sort_order')),
        ]);

      if (Array.isArray(propertyRows)) {
        const normalizedProperties = propertyRows.map((item, index, rows) => ensurePropertySlug(item, rows));
        setProperties(normalizedProperties);
        if (normalizedProperties.length) setSelectedPropertyId(normalizedProperties[0].id);
      }
      if (Array.isArray(photoRows)) setPhotos(photoRows);
      if (Array.isArray(reservationRows)) setReservations(reservationRows);
      if (Array.isArray(movementRows)) setCashMovements(movementRows);
      if (interestRows?.length) {
        setInterestRates(interestRows.map((item) => ({ installments: item.installments, rate: Number(item.rate || 0) })));
      }
      if (!profileResult.error && Array.isArray(profileResult.data)) setProfiles(profileResult.data);
      if (Array.isArray(licenseRows)) setLicenses(licenseRows);
      if (Array.isArray(licenseHistoryRows)) setLicenseHistory(licenseHistoryRows);
      if (Array.isArray(paymentSettingRows)) setPaymentSettings(paymentSettingRows);
      if (Array.isArray(suggestionRows)) setSuggestions(suggestionRows);
      if (Array.isArray(supportTicketRows)) setSupportTickets(supportTicketRows);
      if (Array.isArray(homeBannerRows)) setHomeBanners(homeBannerRows);
    } catch {
      // Keep the public page visible even when optional admin data cannot be loaded.
    } finally {
      setPublicDataChecked(true);
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
      const { data, error } = await safeSupabaseQuery(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle(),
        profileRequestTimeoutMs,
        'Consulta do perfil excedeu o tempo limite.',
      );

      if (data) {
        profile = { ...profile, ...data, role: getAuthRole(data, session.user.email) };
      } else if (!error) {
        void safeSupabaseQuery(
          supabase.from('profiles').upsert({
            id: session.user.id,
            email: session.user.email,
            role: profile.role || 'hospede',
            full_name: profile.full_name,
            phone: profile.phone,
          }),
          profileRequestTimeoutMs,
          'Criacao do perfil excedeu o tempo limite.',
        );
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

  function openAuth(mode = 'login') {
    setAuthInitialMode(mode);
    navigateTo('/login');
  }

  function openAdminSection(view = 'dashboard') {
    setAdminInitialView(view);
    navigateTo('/admin');
  }

  function openClientSection(view = 'dashboard') {
    setClientPortalInitialView(view);
    navigateTo('/hospede');
  }

  function openSuperAdminSection(view = 'dashboard') {
    setSuperAdminInitialView(view);
    navigateTo('/super-admin');
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
      if (isPasswordRecoveryUrl()) setPasswordRecoveryOpen(true);
      const profile = await resolveAuthProfile(data.session);
      if (['super_admin', 'proprietario'].includes(profile?.role)) loadSupabaseData();
    });

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryOpen(true);
        navigateTo('/reset-password');
      }
      const profile = await resolveAuthProfile(session);
      if (['super_admin', 'proprietario'].includes(profile?.role)) loadSupabaseData();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('properties', properties);
  }, [properties]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('selectedPropertyId', selectedPropertyId);
  }, [selectedPropertyId]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('photos', photos);
  }, [photos]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('reservations', reservations);
  }, [reservations]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('cashMovements', cashMovements);
  }, [cashMovements]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('suggestions', suggestions);
  }, [suggestions]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('supportTickets', supportTickets);
  }, [supportTickets]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('homeBanners', homeBanners);
  }, [homeBanners]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('adminLogs', adminLogs);
  }, [adminLogs]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('interestRates', interestRates);
  }, [interestRates]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('profiles', profiles);
  }, [profiles]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('licenses', licenses);
  }, [licenses]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('licenseHistory', licenseHistory);
  }, [licenseHistory]);

  useEffect(() => {
    if (!useDemoFallback) return;
    writeLocalData('paymentSettings', paymentSettings);
  }, [paymentSettings]);

  useEffect(() => {
    writeLocalData('themeMode', themeMode);
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
    document.documentElement.style.colorScheme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    const origin = typeof window === 'undefined' ? 'https://hospedex.com.br' : window.location.origin;
    const image = getPrimaryPhoto(property, photos)?.url || placeholderPhoto.url;
    if (route === '/') {
      updateSeo({
        title: 'Hospedex | Plataforma de hospedagens premium',
        description: 'Encontre hospedagens e gerencie propriedades com reservas online, financeiro, licenças e painel administrativo.',
        image,
        url: origin,
      });
      return;
    }
    if (route === '/casas') {
      updateSeo({
        title: 'Casas cadastradas | Hospedex',
        description: 'Lista de casas cadastradas no Hospedex com busca por nome, cidade e quantidade de hóspedes.',
        image,
        url: `${origin}/casas`,
      });
      return;
    }
    if (route === '/planos') {
      updateSeo({
        title: 'Planos | Hospedex',
        description: 'Planos mensal, semestral e anual para proprietarios que querem publicar hospedagens no Hospedex.',
        image,
        url: `${origin}/planos`,
      });
      return;
    }
    if (route === '/sobre') {
      updateSeo({
        title: 'Sobre | Hospedex',
        description: 'Conheca o Hospedex, a plataforma de hospedagens criada com React, Tailwind, Supabase e Vercel.',
        image,
        url: `${origin}/sobre`,
      });
      return;
    }
    if (routeSlug && property?.id !== 'empty-property') {
      updateSeo({
        title: `${property.name} | Hospedex`,
        description: property.headline || property.description || `Reserve ${property.name} pelo Hospedex.`,
        image,
        url: `${origin}${propertyPath(property)}`,
      });
    }
  }, [route, routeSlug, property, photos]);

  useEffect(() => {
    if (!authChecked) return;
    const protectedRoutes = ['/super-admin', '/admin', '/hospede'];
    if (!protectedRoutes.includes(route)) return;
    if (!authProfile) {
      if (route !== '/login') navigateTo('/login');
      return;
    }
    if (!canAccessRoute(route, authProfile)) {
      const nextPath = roleHomePath(authProfile?.role);
      if (nextPath !== route) navigateTo(nextPath);
      return;
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
    if (route !== '/super-admin' || normalizeRole(authProfile?.role) !== 'super_admin') return;
    loadSupabaseData();
  }, [route, authProfile?.id, authProfile?.role]);

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
      try {
        createdReservation = await createReservationRecord(supabase, reservation);
        setReservations((current) => [...current, createdReservation]);
      } catch {
        setMessage('Não foi possível criar a reserva agora. Confira os dados e tente novamente.');
        return;
      }
    } else {
      const localReservation = { ...reservation, id: crypto.randomUUID() };
      createdReservation = localReservation;
      setReservations((current) => [...current, localReservation]);
    }

    const ownerNotificationUrl = buildOwnerNotificationUrl({
      property,
      reservation: createdReservation,
      nights,
    });
    setLastWhatsAppUrl(ownerNotificationUrl);
    if (ownerNotificationUrl) window.open(ownerNotificationUrl, '_blank', 'noopener,noreferrer');

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
      try {
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
      } catch {
        setAuthProfile(authProfile);
      }
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
    const normalized = ensurePropertySlug({
      ...updated,
      owner_id: updated.owner_id || (normalizeRole(authProfile?.role) === 'proprietario' ? authProfile.id : updated.owner_id),
      owner_email: updated.owner_email || (normalizeRole(authProfile?.role) === 'proprietario' ? authProfile.email : fallbackOwnerEmail),
      maps_url: normalizeExternalUrl(updated.maps_url),
    }, properties);

    setProperties((current) => current.map((item) => (item.id === normalized.id ? normalized : item)));
    if (hasSupabaseConfig) {
      try {
        await updatePropertyRecord(
          supabase,
          normalized,
          normalizeRole(authProfile?.role) === 'proprietario' ? authProfile.id : null,
        );
      } catch {
        setMessage('Nao foi possivel salvar a casa agora.');
        return;
      }
    }
    setMessage('Informações da casa atualizadas.');
  }

  function selectProperty(propertyId) {
    if (propertyId === property.id) return;
    setSelectedPropertyId(propertyId);
  }

  async function addProperty(propertyDraft) {
    const propertyPayload = ensurePropertySlug({
      ...emptyProperty,
      ...propertyDraft,
      id: crypto.randomUUID(),
      owner_id: propertyDraft.owner_id || (normalizeRole(authProfile?.role) === 'proprietario' ? authProfile.id : null),
      daily_rate: Number(propertyDraft.daily_rate || 0),
      cleaning_fee: Number(propertyDraft.cleaning_fee || 0),
      max_guests: Number(propertyDraft.max_guests || 1),
      bedrooms: Number(propertyDraft.bedrooms || 1),
      bathrooms: Number(propertyDraft.bathrooms || 1),
      owner_whatsapp: propertyDraft.owner_whatsapp || fallbackOwnerWhatsapp,
      owner_email: propertyDraft.owner_email || authProfile?.email || fallbackOwnerEmail,
      maps_url: normalizeExternalUrl(propertyDraft.maps_url),
      active: propertyDraft.active !== false,
      license_key: propertyDraft.license_key || '',
      license_expires_at: propertyDraft.license_expires_at || '',
      license_active: propertyDraft.license_active !== false,
      amenities: Array.isArray(propertyDraft.amenities) ? propertyDraft.amenities : [],
      rules: Array.isArray(propertyDraft.rules) ? propertyDraft.rules : [],
    }, properties);

    let createdProperty = propertyPayload;
    if (hasSupabaseConfig) {
      try {
        createdProperty = await createPropertyRecord(supabase, propertyPayload);
      } catch {
        setMessage('Não foi possível cadastrar a casa agora.');
        return;
      }
    }

    setProperties((current) => [...current, createdProperty]);
    setSelectedPropertyId(createdProperty.id);
    setMessage('Casa cadastrada. Agora adicione fotos e ajuste os dados.');
  }

  async function deleteProperty(propertyId) {
    if (typeof window !== 'undefined' && !window.confirm('Tem certeza que deseja excluir esta casa?')) return;
    const nextProperties = properties.filter((item) => item.id !== propertyId);
    setProperties(nextProperties);
    setPhotos((current) => current.filter((photo) => photo.property_id !== propertyId));
    setReservations((current) => current.filter((reservation) => reservation.property_id !== propertyId));
    setCashMovements((current) => current.filter((movement) => movement.property_id !== propertyId));
    if (selectedPropertyId === propertyId) setSelectedPropertyId(nextProperties[0]?.id || '');
    if (hasSupabaseConfig) {
      try {
        await deletePropertyRecord(
          supabase,
          propertyId,
          normalizeRole(authProfile?.role) === 'proprietario' ? authProfile.id : null,
        );
      } catch {
        setMessage('Nao foi possivel excluir a casa agora.');
        await loadSupabaseData();
        return;
      }
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

  async function addCashMovement(movementDraft, targetPropertyId = property.id) {
    const movement = {
      property_id: targetPropertyId,
      reservation_id: movementDraft.reservation_id || null,
      type: movementDraft.type || 'income',
      status: movementDraft.status || 'expected',
      payment_method: movementDraft.payment_method || 'cash',
      amount: Number(movementDraft.amount || 0),
      due_date: movementDraft.due_date || format(new Date(), 'yyyy-MM-dd'),
      paid_at: movementDraft.status === 'received' ? movementDraft.paid_at || new Date().toISOString() : null,
      description: movementDraft.description || '',
    };
    const localMovement = { ...movement, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    setCashMovements((current) => [localMovement, ...current]);
    if (hasSupabaseConfig) {
      const { data, error } = await supabase.from('cash_movements').insert(movement).select().maybeSingle();
      if (error) {
        setCashMovements((current) => current.filter((item) => item.id !== localMovement.id));
        setMessage('Nao foi possivel salvar a movimentacao financeira agora.');
        return null;
      }
      if (data) {
        setCashMovements((current) => current.map((item) => (item.id === localMovement.id ? data : item)));
        return data;
      }
    }
    return localMovement;
  }

  async function createManualReservation(reservationDraft, targetProperty = property) {
    const reservation = {
      property_id: targetProperty.id,
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
    const targetReservations = reservations.filter((item) => item.property_id === targetProperty.id);
    if (hasConflict(targetReservations, reservation.check_in, reservation.check_out)) {
      setMessage('Não foi possível criar: as datas conflitam com outra reserva ou bloqueio.');
      return false;
    }
    let created = { ...reservation, id: crypto.randomUUID() };
    if (hasSupabaseConfig) {
      try {
        created = await createReservationRecord(supabase, reservation);
      } catch {
        setMessage('Não foi possível criar a reserva manual agora.');
        return false;
      }
    }
    setReservations((current) => [...current, created]);
    if (Number(created.total_amount || 0) > 0 && !['blocked', 'maintenance'].includes(created.status)) {
      await addCashMovement(
        {
          reservation_id: created.id,
          type: 'income',
          status: created.payment_status === 'paid' ? 'received' : 'expected',
          payment_method: created.payment_method || 'cash',
          amount: created.total_amount,
          due_date: created.check_in || format(new Date(), 'yyyy-MM-dd'),
          description: `Reserva manual - ${created.guest_name}`,
        },
        targetProperty.id,
      );
    }
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
    if (normalizeRole(authProfile?.role) !== 'super_admin') {
      setMessage('Somente o Super Admin pode alterar juros.');
      return;
    }
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
        .maybeSingle();
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
      if (emailError) console.warn('Suggestion email notification failed:', emailError.message || emailError);
    }
    setMessage('Sugestão enviada. Obrigado por ajudar a melhorar o site.');
  }

  async function signOut() {
    if (hasSupabaseConfig) await supabase.auth.signOut();
    setAdminSession(null);
    setAuthProfile(null);
    setAdminUnlocked(false);
    setAdminOpen(false);
    setClientPortalOpen(false);
    navigateTo('/');
  }

  if (!hasSupabaseConfig && !useDemoFallback) {
    return <SupabaseConfigError />;
  }

  if (route === '/login') {
    return (
      <LoginPage>
        <div className="min-h-screen bg-[#f4f8ff] text-ink" style={propertyThemeStyle}>
          <AuthModal
            initialMode={authInitialMode}
            onClose={() => navigateTo('/')}
            onAuthenticated={(profile) => {
              setAuthProfile(profile);
              setAdminUnlocked(['proprietario', 'super_admin'].includes(normalizeRole(profile.role)));
              setAdminOpen(false);
              setClientPortalOpen(false);
              navigateTo(roleHomePath(profile.role));
            }}
            resolveAuthProfile={resolveAuthProfile}
          />
          {passwordRecoveryOpen ? (
            <PasswordRecoveryModal
              onClose={() => {
                setPasswordRecoveryOpen(false);
                navigateTo('/login');
              }}
            />
          ) : null}
        </div>
      </LoginPage>
    );
  }

  if (route === '/reset-password' || route === '/resetar-senha') {
    return (
      <LoginPage>
        <div className="min-h-screen bg-[#f4f8ff] text-ink" style={propertyThemeStyle}>
          <PasswordRecoveryModal
            onClose={() => {
              setPasswordRecoveryOpen(false);
              navigateTo('/login');
            }}
          />
        </div>
      </LoginPage>
    );
  }

  if (route === '/super-admin') {
    return (
      <SuperAdminDashboardPage>
        <AuthGuard
          loading={!authChecked}
          authenticated={Boolean(authProfile)}
          allowed={normalizeRole(authProfile?.role) === 'super_admin'}
          unauthenticatedFallback={
            <AccessDenied
              title="Login necessário"
              text="Entre para acessar a área de Super Admin."
              onLogin={() => navigateTo('/login')}
              onHome={() => navigateTo('/')}
            />
          }
          deniedFallback={
            <AccessDenied
              title="Acesso restrito"
              text="A área de Super Admin é privada e exige permissão super_admin."
              onLogin={() => navigateTo('/login')}
              onHome={() => navigateTo('/')}
            />
          }
        >
          <SuperAdminDashboard
            profiles={profiles}
            properties={properties}
            reservations={reservations}
            cashMovements={cashMovements}
            licenses={licenses}
            setLicenses={setLicenses}
            licenseHistory={licenseHistory}
            suggestions={suggestions}
            setLicenseHistory={setLicenseHistory}
            setProfiles={setProfiles}
            setProperties={setProperties}
            authProfile={authProfile}
            supportTickets={supportTickets}
            onSignOut={signOut}
            onHome={() => navigateTo('/')}
            onRefresh={loadSupabaseData}
            addAdminLog={addAdminLog}
            homeBanners={homeBanners}
            setHomeBanners={setHomeBanners}
            initialView={superAdminInitialView}
          />
        </AuthGuard>
      </SuperAdminDashboardPage>
    );
  }

  if (route === '/admin' || route === '/hospede') {
    const targetLabel = route === '/admin' ? 'painel do proprietário' : 'portal do hóspede';
    const fallbackText = `Entre para acessar o ${targetLabel}.`;

    if (!authChecked) {
      return <LoadingState label="Validando acesso..." />;
    }

    if (!authProfile) {
      return (
        <AccessDenied
          title="Login necessário"
          text={fallbackText}
          onLogin={() => navigateTo('/login')}
          onHome={() => navigateTo('/')}
        />
      );
    }

    if (!canAccessRoute(route, authProfile)) {
      return (
        <AccessDenied
          title="Acesso restrito"
          text="Seu perfil foi carregado, mas não tem permissão para esta área."
          onLogin={() => navigateTo(roleHomePath(authProfile.role))}
          onHome={() => navigateTo('/')}
        />
      );
    }
  }

  if (route === '/') {
    return (
      <HomePage>
        <MarketingHome
          authProfile={authProfile}
          dataChecked={publicDataChecked}
          photos={photos}
          properties={publicProperties}
          homeBanners={homeBanners}
          onNavigate={navigateTo}
          onAuth={openAuth}
          onOpenAdmin={openAdminSection}
          onOpenClient={openClientSection}
          onOpenSuperAdmin={openSuperAdminSection}
          onSignOut={signOut}
          themeMode={themeMode}
          onToggleTheme={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
        />
      </HomePage>
    );
  }

  if (route === '/casas') {
    return (
      <CasasPage>
        <HousesListingPage
          authProfile={authProfile}
          dataChecked={publicDataChecked}
          photos={photos}
          properties={publicProperties}
          onNavigate={navigateTo}
          onAuth={openAuth}
          onOpenAdmin={openAdminSection}
          onOpenClient={openClientSection}
          onOpenSuperAdmin={openSuperAdminSection}
          onSignOut={signOut}
          themeMode={themeMode}
          onToggleTheme={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
        />
      </CasasPage>
    );
  }

  if (route === '/planos') {
    return (
      <PlansPage
        authProfile={authProfile}
        onNavigate={navigateTo}
        onAuth={openAuth}
        onOpenAdmin={openAdminSection}
        onOpenClient={openClientSection}
        onOpenSuperAdmin={openSuperAdminSection}
        onSignOut={signOut}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  if (route === '/sobre') {
    return (
      <AboutPage
        authProfile={authProfile}
        onNavigate={navigateTo}
        onAuth={openAuth}
        onOpenAdmin={openAdminSection}
        onOpenClient={openClientSection}
        onOpenSuperAdmin={openSuperAdminSection}
        onSignOut={signOut}
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((current) => (current === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  if (routeSlug && publicDataChecked && (!routeProperty || !canViewRouteProperty)) {
    return (
      <AccessDenied
        title="Hospedagem não encontrada"
        text="A casa informada não existe, foi removida ou ainda não possui slug público."
        onLogin={() => navigateTo('/login')}
        onHome={() => navigateTo('/casas')}
      />
    );
  }

  return (
    <CasaDetalhePage>
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
            {authProfile ? (
              <Button
                variant="outline"
                onClick={() => {
                  if (normalizeRole(authProfile.role) === 'super_admin') openSuperAdminSection('dashboard');
                  else if (normalizeRole(authProfile.role) === 'proprietario' || adminUnlocked) openAdminSection('dashboard');
                  else openClientSection('reservations');
                }}
                aria-label="Abrir menu do usuario"
                className="px-3"
              >
                <User size={18} />
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => openAuth('login')}>Login</Button>
                <Button onClick={() => openAuth('signup')}>Cadastrar</Button>
              </>
            )}
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
                        onClick={() => {
                          selectProperty(item.id);
                          navigateTo(propertyPath(item));
                        }}
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
            <InfoStat icon={Bath} label="Banheiros" value={property.bathrooms} />
            <InfoStat icon={Users} label="Hóspedes" value={`até ${property.max_guests}`} />
            <InfoStat icon={Wallet} label="Diária" value={currency.format(property.daily_rate)} />
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8 dark:text-white">
          <div>
            <p className="text-base leading-8 text-ink/75 dark:text-white/75">{property.description}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {property.amenities?.map((item) => {
                const AmenityIcon = getAmenityIcon(item);
                return (
                  <div key={item} className="flex items-center gap-3 rounded-md bg-white px-4 py-3 shadow-sm dark:bg-slate-900 dark:text-white dark:ring-1 dark:ring-white/10">
                    <AmenityIcon className="text-leaf" size={18} />
                    <span className="font-semibold">{item}</span>
                  </div>
                );
              })}
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
                Envie ideias, ajustes ou melhorias. A sugestao fica registrada no sistema para acompanhamento.
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
        <button
          type="button"
          className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink shadow-soft transition hover:-translate-y-0.5"
          onClick={() => scrollToSection('sugestoes')}
          aria-label="Enviar suporte"
        >
          <Mail size={20} />
        </button>
      </div>

      <footer className="border-t border-ink/10 bg-ink px-4 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BrandLogo variant="white" className="h-16 w-16 rounded-xl" />
            <p className="mt-2 text-sm font-semibold text-white/80">{property.name}</p>
          </div>
          <p className="text-sm text-white/70">Reservas, calendário e check-in online.</p>
        </div>
      </footer>

      {adminOpen || (route === '/admin' && canAccessRoute('/admin', authProfile)) ? (
        <AdminDashboardPage>
          <AdminPanel
            addProperty={addProperty}
            addPhoto={addPhoto}
            adminUnlocked={adminUnlocked}
            adminSession={adminSession}
            deleteProperty={deleteProperty}
            deletePhoto={deletePhoto}
            onClose={() => {
              setAdminOpen(false);
              if (route === '/admin') navigateTo('/');
            }}
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
            addCashMovement={addCashMovement}
            saveProperty={saveProperty}
            savePaymentSettings={savePaymentSettings}
            updateReservationDetails={updateReservationDetails}
            updateReservationStatus={updateReservationStatus}
            initialView={adminInitialView}
          />
        </AdminDashboardPage>
      ) : null}

      {authOpen ? (
        <AuthModal
          initialMode={authInitialMode}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={(profile) => {
            setAuthProfile(profile);
            setAdminUnlocked(['proprietario', 'super_admin'].includes(normalizeRole(profile.role)));
            setAuthOpen(false);
            setAdminOpen(false);
            setClientPortalOpen(false);
            navigateTo(roleHomePath(profile.role));
          }}
          resolveAuthProfile={resolveAuthProfile}
        />
      ) : null}

      {passwordRecoveryOpen ? (
        <PasswordRecoveryModal onClose={() => setPasswordRecoveryOpen(false)} />
      ) : null}

      {clientPortalOpen || (route === '/hospede' && canAccessRoute('/hospede', authProfile)) ? (
        <HospedePortalPage>
          <ClientPortal
            authProfile={authProfile}
            reservations={reservations}
            properties={properties}
            onUpdateProfile={updateClientProfile}
            voucherSummary={getVoucherSummary(
              reservations.filter((reservation) => reservation.guest_email === authProfile?.email),
            )}
            onClose={() => {
              setClientPortalOpen(false);
              if (route === '/hospede') navigateTo('/');
            }}
            onSignOut={signOut}
            initialView={clientPortalInitialView}
          />
        </HospedePortalPage>
      ) : null}

      </div>
    </CasaDetalhePage>
  );
}

function upsertMetaTag(selector, attributes) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
}

function updateSeo({ title, description, image, url }) {
  if (typeof document === 'undefined') return;
  document.title = title;
  upsertMetaTag('meta[name="description"]', { name: 'description', content: description });
  upsertMetaTag('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMetaTag('meta[property="og:description"]', { property: 'og:description', content: description });
  upsertMetaTag('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  upsertMetaTag('meta[property="og:url"]', { property: 'og:url', content: url });
  if (image) upsertMetaTag('meta[property="og:image"]', { property: 'og:image', content: image });
}

function PublicTopBar({
  authProfile,
  onNavigate,
  onAuth,
  onOpenAdmin,
  onOpenClient,
  onOpenSuperAdmin,
  onSignOut,
  transparent = false,
  themeMode = 'light',
  onToggleTheme,
}) {
  const role = normalizeRole(authProfile?.role);
  const linkClass = `inline-flex items-center gap-2 transition ${transparent ? 'hover:text-white' : 'hover:text-leaf'}`;
  const menuItems =
    role === 'super_admin'
      ? [
          ['Painel super admin', () => onOpenSuperAdmin?.('dashboard'), ShieldCheck],
          ['Usuários', () => onOpenSuperAdmin?.('users'), Users],
          ['Licenças', () => onOpenSuperAdmin?.('licenses'), KeyRound],
          ['Sugestões', () => onOpenSuperAdmin?.('suggestions'), Lightbulb],
          ['Logs', () => onOpenSuperAdmin?.('settings'), Logs],
          ['Banners/Home', () => onOpenSuperAdmin?.('banners'), ImagePlus],
        ]
      : role === 'proprietario'
        ? [
            ['Meu perfil', () => onOpenAdmin?.('admin'), CircleUserRound],
            ['Minhas propriedades', () => onOpenAdmin?.('houses'), Home],
            ['Reservas', () => onOpenAdmin?.('reservations'), CalendarDays],
            ['Financeiro', () => onOpenAdmin?.('cash'), Wallet],
            ['Copiar links', () => onOpenAdmin?.('houses'), Link2],
          ]
        : role === 'hospede'
          ? [
              ['Meu perfil', () => onOpenClient?.('profile'), CircleUserRound],
              ['Minhas reservas', () => onOpenClient?.('reservations'), CalendarDays],
              ['Suporte', () => onOpenClient?.('support'), Headset],
              ['Configurações', () => onOpenClient?.('settings'), Settings],
            ]
          : [];
  const openSupport = () => {
    if (role === 'hospede') onOpenClient?.('support');
    else if (role === 'super_admin') onOpenSuperAdmin?.('support');
    else onOpenAdmin?.('settings');
  };
  const openSettings = () => {
    if (role === 'hospede') onOpenClient?.('settings');
    else if (role === 'super_admin') onOpenSuperAdmin?.('settings');
    else onOpenAdmin?.('settings');
  };

  const brand = (
    <button type="button" className="flex min-w-0 items-center gap-3" onClick={() => onNavigate('/')} aria-label="Ir para a home">
      <BrandLogo variant={transparent ? 'white' : 'horizontal'} className="h-11 w-11 rounded-md shadow-sm" />
    </button>
  );
  const navigation = (
    <nav className="hidden items-center gap-5 text-sm font-bold md:flex">
      <button type="button" className={linkClass} onClick={() => onNavigate('/casas')}>
        <Home size={16} />
        Hospedagens
      </button>
      <button type="button" className={linkClass} onClick={() => onNavigate('/planos')}>
        <BadgeDollarSign size={16} />
        Planos
      </button>
      <button type="button" className={linkClass} onClick={() => onNavigate('/sobre')}>
        <ShieldCheck size={16} />
        Sobre
      </button>
      <a className={linkClass} href={socialLinks.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
        <Instagram size={18} />
      </a>
      <a className={linkClass} href={socialLinks.email} target="_blank" rel="noreferrer" aria-label="Email">
        <Mail size={18} />
      </a>
      <a className={linkClass} href={socialLinks.twitter} target="_blank" rel="noreferrer" aria-label="Twitter X">
        <Twitter size={18} />
      </a>
    </nav>
  );
  const themeToggle = (
    <button type="button" className="brand-icon-button" onClick={onToggleTheme} aria-label="Alternar tema" title="Alternar tema">
      {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
  const account = authProfile ? (
    <UserMenu
      authProfile={authProfile}
      menuItems={menuItems}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      onOpenSupport={openSupport}
      onOpenSettings={openSettings}
    />
  ) : (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" className="px-3 sm:px-5" onClick={() => onAuth?.('login') || onNavigate('/login')}>
        <Lock size={17} />
        Login
      </Button>
      <Button type="button" className="hidden sm:inline-flex" onClick={() => onAuth?.('signup') || onNavigate('/login')}>
        <UserPlus size={17} />
        Cadastrar
      </Button>
    </div>
  );

  return (
    <NavbarShell
      transparent={transparent}
      brand={brand}
      nav={navigation}
      themeToggle={themeToggle}
      account={account}
    />
  );
}
function SiteFooter({ onNavigate }) {
  return (
    <footer className="border-t border-ink/10 bg-ink px-4 py-8 text-white">
      <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <BrandLogo variant="white" className="h-16 w-16 rounded-xl" />
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
            Plataforma para turismo, hospedagem e aluguel por temporada com reservas, calendario e gestao de propriedades.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button type="button" className="brand-icon-button bg-white/10 text-white hover:text-white" onClick={() => onNavigate?.('/casas')} aria-label="Hospedagens" title="Hospedagens">
            <Home size={18} />
          </button>
          <a className="brand-icon-button bg-white/10 text-white hover:text-white" href={socialLinks.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram">
            <Instagram size={18} />
          </a>
          <a className="brand-icon-button bg-white/10 text-white hover:text-white" href={socialLinks.email} target="_blank" rel="noreferrer" aria-label="Email" title="Email">
            <Mail size={18} />
          </a>
        </div>
      </div>
    </footer>
  );
}

function PropertyCard({ property, photo, onNavigate }) {
  const stats = [
    [BedDouble, property.bedrooms || 1, 'quartos'],
    [Bath, property.bathrooms || 1, 'banheiros'],
    [Users, property.max_guests || 1, 'hóspedes'],
  ];

  return (
    <article className="brand-card brand-card-hover overflow-hidden rounded-md">
      <button type="button" className="block w-full text-left" onClick={() => onNavigate(propertyPath(property))}>
        <div className="relative">
          <img className="h-56 w-full object-cover" src={photo?.url || placeholderPhoto.url} alt={photo?.alt || property.name} />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1.5 text-xs font-black text-ink shadow-sm">
            <Wallet size={14} className="text-leaf" />
            {currency.format(property.daily_rate || 0)}
          </span>
        </div>
        <div className="grid gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">{property.name}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-ink/60">
                <MapPin size={15} />
                {property.city || 'Cidade não informada'}
              </p>
            </div>
            <span className="rounded-md bg-leaf/10 px-2 py-1 text-xs font-black text-leaf">Premium</span>
          </div>
          <p className="text-sm text-ink/65 line-clamp-2">{property.headline || property.description || 'Hospedagem cadastrada no Hospedex.'}</p>
          <div className="grid grid-cols-3 gap-2">
            {stats.map(([Icon, value, label]) => (
              <span key={label} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#f6f8fb] px-2 py-2 text-xs font-bold text-ink/70">
                <Icon size={15} className="text-leaf" />
                {value}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
            <strong className="inline-flex items-center gap-2 text-sm">
              <BadgeDollarSign size={16} className="text-leaf" />
              / diária
            </strong>
            <span className="inline-flex items-center gap-1 text-sm font-black text-leaf">
              <Eye size={16} />
              Ver
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

function HousesSearch({ query, setQuery, city, setCity, guests, setGuests }) {
  return (
    <div className="grid gap-3 rounded-md bg-white p-3 shadow-soft ring-1 ring-ink/10 md:grid-cols-[1fr_220px_170px]">
      <label className="flex items-center gap-3 rounded-md bg-mist px-3">
        <Search size={18} className="text-ink/55" />
        <input
          className="min-h-12 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-ink/45"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome da casa"
        />
      </label>
      <label className="flex items-center gap-3 rounded-md bg-mist px-3">
        <MapPin size={18} className="text-ink/55" />
        <input
          className="min-h-12 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-ink/45"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="Cidade"
        />
      </label>
      <label className="flex items-center gap-3 rounded-md bg-mist px-3">
        <Users size={18} className="text-ink/55" />
        <input
          className="min-h-12 w-full bg-transparent text-sm font-semibold outline-none"
          type="number"
          min="1"
          value={guests}
          onChange={(event) => setGuests(event.target.value)}
          placeholder="Hóspedes"
        />
      </label>
    </div>
  );
}

function filterProperties(properties, query, city, guests) {
  const normalizedQuery = String(query || '').toLowerCase();
  const normalizedCity = String(city || '').toLowerCase();
  const guestCount = Number(guests || 0);
  return properties.filter((property) => {
    const matchesQuery = !normalizedQuery || String(property.name || '').toLowerCase().includes(normalizedQuery);
    const matchesCity = !normalizedCity || String(property.city || '').toLowerCase().includes(normalizedCity);
    const matchesGuests = !guestCount || Number(property.max_guests || 0) >= guestCount;
    return matchesQuery && matchesCity && matchesGuests;
  });
}

function MarketingHome({
  authProfile,
  dataChecked,
  photos,
  properties,
  homeBanners = [],
  onNavigate,
  onAuth,
  onOpenAdmin,
  onOpenClient,
  onOpenSuperAdmin,
  onSignOut,
  themeMode,
  onToggleTheme,
}) {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [guests, setGuests] = useState('');
  const filtered = filterProperties(properties, query, city, guests).slice(0, 6);
  const primaryBanner =
    homeBanners.find((banner) => banner.active !== false && banner.is_primary) ||
    homeBanners.find((banner) => banner.active !== false);
  const heroPhoto = primaryBanner
    ? { url: primaryBanner.image_url, alt: primaryBanner.title || 'Hospedex' }
    : getPrimaryPhoto(properties[0], photos) || placeholderPhoto;
  const mockups = [
    ['Tela hóspede', User, 'Busca, calendário e solicitação de reserva'],
    ['Tela proprietário', Home, 'Casas, fotos, reservas e caixa'],
    ['Tela admin', ShieldCheck, 'Usuários, licenças e gestão global'],
    ['Reservas', CalendarDays, 'Status, pagamentos e hóspedes'],
    ['Calendário', ClipboardList, 'Bloqueios e disponibilidade'],
    ['Financeiro', Wallet, 'Receitas, despesas e previsões'],
  ];

  return (
    <div className="min-h-screen bg-[#f4f8ff] text-ink">
      <PublicTopBar
        authProfile={authProfile}
        onNavigate={onNavigate}
        onAuth={onAuth}
        onOpenAdmin={onOpenAdmin}
        onOpenClient={onOpenClient}
        onOpenSuperAdmin={onOpenSuperAdmin}
        onSignOut={onSignOut}
        themeMode={themeMode}
        onToggleTheme={onToggleTheme}
      />
      <main>
        <section className="relative overflow-hidden bg-ink text-white">
          <img className="absolute inset-0 h-full w-full object-cover opacity-45" src={heroPhoto.url} alt={heroPhoto.alt || 'Hospedagem'} />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/35" />
          <div className="relative mx-auto grid min-h-[640px] max-w-7xl content-center gap-8 px-4 py-20 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h1 className="text-5xl font-black leading-tight sm:text-7xl">Hospedex</h1>
              <p className="mt-5 max-w-2xl text-xl leading-8 text-white/88">
                Plataforma premium para publicar hospedagens, receber reservas online e administrar propriedades com controle financeiro e licenças.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button type="button" onClick={() => onNavigate('/casas')}>Ver hospedagens</Button>
              </div>
            </div>
            <div className="max-w-5xl">
              <HousesSearch query={query} setQuery={setQuery} city={city} setCity={setCity} guests={guests} setGuests={setGuests} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Reservas online', CalendarDays],
              ['Painel proprietário', Building2],
              ['Financeiro e licenças', Wallet],
            ].map(([label, Icon]) => (
              <div key={label} className="rounded-md bg-white p-5 shadow-sm ring-1 ring-ink/10">
                <Icon className="text-leaf" />
                <h2 className="mt-4 text-xl font-black">{label}</h2>
                <p className="mt-2 text-sm leading-6 text-ink/65">
                  Gestão integrada para hóspedes, proprietários e administração global, com permissões separadas por perfil.
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black">Previews da plataforma</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mockups.map(([title, Icon, text]) => (
                <div key={title} className="rounded-md bg-[#f4f8ff] p-4 shadow-sm ring-1 ring-ink/10">
                  <div className="flex items-center justify-between">
                    <strong>{title}</strong>
                    <Icon size={20} className="text-leaf" />
                  </div>
                  <div className="mt-4 grid gap-2">
                    <span className="h-3 w-2/3 rounded-full bg-ink/15" />
                    <span className="h-3 w-full rounded-full bg-ink/10" />
                    <span className="h-20 rounded-md bg-white shadow-sm" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-ink/60">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-3xl font-black">Hospedagens</h2>
              <p className="mt-2 text-ink/65">Casas cadastradas e disponíveis no Hospedex.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => onNavigate('/casas')}>Ver todas</Button>
          </div>
          {!dataChecked ? (
            <SkeletonGrid />
          ) : filtered.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((property) => (
                <PropertyCard key={property.id} property={property} photo={getPrimaryPhoto(property, photos)} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma casa encontrada" text="Ajuste a busca ou cadastre a primeira hospedagem no painel." />
          )}
        </section>
      </main>
      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}

function HousesListingPage({
  authProfile,
  dataChecked,
  photos,
  properties,
  onNavigate,
  onAuth,
  onOpenAdmin,
  onOpenClient,
  onOpenSuperAdmin,
  onSignOut,
  themeMode,
  onToggleTheme,
}) {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [guests, setGuests] = useState('');
  const filtered = filterProperties(properties, query, city, guests);

  return (
    <div className="min-h-screen bg-[#f4f8ff] text-ink">
      <PublicTopBar
        authProfile={authProfile}
        onNavigate={onNavigate}
        onAuth={onAuth}
        onOpenAdmin={onOpenAdmin}
        onOpenClient={onOpenClient}
        onOpenSuperAdmin={onOpenSuperAdmin}
        onSignOut={onSignOut}
        themeMode={themeMode}
        onToggleTheme={onToggleTheme}
      />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-4xl font-black">Casas cadastradas</h1>
          <p className="mt-2 text-ink/65">Busque por nome, cidade ou quantidade de hóspedes.</p>
        </div>
        <HousesSearch query={query} setQuery={setQuery} city={city} setCity={setCity} guests={guests} setGuests={setGuests} />
        <div className="mt-8">
          {!dataChecked ? (
            <SkeletonGrid />
          ) : filtered.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((property) => (
                <PropertyCard key={property.id} property={property} photo={getPrimaryPhoto(property, photos)} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nenhuma hospedagem encontrada" text="Não há casas reais cadastradas para esses filtros." />
          )}
        </div>
      </main>
      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}

function PlansPage({ authProfile, onNavigate, onAuth, onOpenAdmin, onOpenClient, onOpenSuperAdmin, onSignOut, themeMode, onToggleTheme }) {
  return (
    <div className="min-h-screen bg-[#f4f8ff] text-ink">
      <PublicTopBar
        authProfile={authProfile}
        onNavigate={onNavigate}
        onAuth={onAuth}
        onOpenAdmin={onOpenAdmin}
        onOpenClient={onOpenClient}
        onOpenSuperAdmin={onOpenSuperAdmin}
        onSignOut={onSignOut}
        themeMode={themeMode}
        onToggleTheme={onToggleTheme}
      />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-wide text-leaf">Planos Hospedex</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">Escolha o plano para publicar suas hospedagens</h1>
          <p className="mt-4 text-lg leading-8 text-ink/65">
            Estrutura pronta para integrar pagamentos recorrentes depois, mantendo licencas, propriedades e financeiro separados.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {planCards.map((plan) => (
            <article
              key={plan.id}
              className={`grid gap-5 rounded-md bg-white p-6 shadow-sm ring-1 ${
                plan.highlighted ? 'ring-leaf shadow-soft' : 'ring-ink/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">{plan.title}</h2>
                  <p className="mt-1 text-sm font-bold text-leaf">{plan.savings}</p>
                </div>
                {plan.highlighted ? <span className="rounded-md bg-leaf px-3 py-1 text-xs font-black text-white">Destaque</span> : null}
              </div>
              <div>
                <strong className="text-4xl font-black">{currency.format(plan.price)}</strong>
                <span className="ml-1 text-sm font-bold text-ink/55">{plan.period}</span>
              </div>
              <p className="rounded-md bg-[#f4f8ff] px-3 py-2 text-sm font-bold">
                {plan.propertyLimit} propriedade(s) permitida(s)
              </p>
              <div className="grid gap-2">
                {plan.benefits.map((benefit) => (
                  <p key={benefit} className="flex items-center gap-2 text-sm font-semibold text-ink/70">
                    <Check size={16} className="text-leaf" />
                    {benefit}
                  </p>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Button type="button" onClick={() => onAuth?.('signup')}>
                  Contratar plano
                </Button>
                <Button type="button" variant="outline" onClick={() => onAuth?.('signup')}>
                  Comecar agora
                </Button>
              </div>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}

function AboutPage({ authProfile, onNavigate, onAuth, onOpenAdmin, onOpenClient, onOpenSuperAdmin, onSignOut, themeMode, onToggleTheme }) {
  const techs = ['React/Vite', 'Tailwind', 'Supabase', 'Vercel'];
  return (
    <div className="min-h-screen bg-[#f4f8ff] text-ink">
      <PublicTopBar
        authProfile={authProfile}
        onNavigate={onNavigate}
        onAuth={onAuth}
        onOpenAdmin={onOpenAdmin}
        onOpenClient={onOpenClient}
        onOpenSuperAdmin={onOpenSuperAdmin}
        onSignOut={onSignOut}
        themeMode={themeMode}
        onToggleTheme={onToggleTheme}
      />
      <main className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <section className="grid gap-6">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-leaf">Sobre o Hospedex</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">Uma plataforma para hospedagens reais, gestao simples e controle seguro</h1>
            <p className="mt-5 text-lg leading-8 text-ink/65">
              O Hospedex conecta hospedes a casas cadastradas e entrega ao proprietario um painel para reservas, calendario,
              financeiro, licencas e propriedades. O objetivo e reduzir improvisos e manter cada perfil com permissoes claras.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {['Reservas com historico', 'Isolamento por proprietario', 'Licencas preservando dados', 'Financeiro com caixa'].map((item) => (
              <div key={item} className="rounded-md bg-white p-4 shadow-sm ring-1 ring-ink/10">
                <Check className="text-leaf" size={18} />
                <p className="mt-3 font-black">{item}</p>
              </div>
            ))}
          </div>
        </section>
        <aside className="grid gap-5">
          <div className="rounded-md bg-white p-5 shadow-sm ring-1 ring-ink/10">
            <h2 className="text-xl font-black">Desenvolvedor</h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">Glawck H. Silva</p>
          </div>
          <div className="rounded-md bg-white p-5 shadow-sm ring-1 ring-ink/10">
            <h2 className="text-xl font-black">Tecnologias</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {techs.map((tech) => (
                <span key={tech} className="rounded-md bg-[#f4f8ff] px-3 py-2 text-sm font-black">
                  {tech}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-md bg-white p-5 shadow-sm ring-1 ring-ink/10">
            <h2 className="text-xl font-black">Contato</h2>
            <p className="mt-2 text-sm font-semibold text-ink/65">{commercialEmail}</p>
            <div className="mt-4 flex gap-2">
              <a className="grid h-11 w-11 place-items-center rounded-md bg-[#f4f8ff] text-ink hover:text-leaf" href={socialLinks.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={18} />
              </a>
              <a className="grid h-11 w-11 place-items-center rounded-md bg-[#f4f8ff] text-ink hover:text-leaf" href={socialLinks.email} target="_blank" rel="noreferrer" aria-label="Email">
                <Mail size={18} />
              </a>
              <a className="grid h-11 w-11 place-items-center rounded-md bg-[#f4f8ff] text-ink hover:text-leaf" href={socialLinks.twitter} target="_blank" rel="noreferrer" aria-label="Twitter X">
                <Twitter size={18} />
              </a>
            </div>
          </div>
        </aside>
      </main>
      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="animate-pulse rounded-md bg-white p-4 shadow-sm ring-1 ring-ink/10">
          <div className="h-48 rounded-md bg-ink/10" />
          <div className="mt-4 h-4 w-2/3 rounded bg-ink/10" />
          <div className="mt-3 h-3 w-full rounded bg-ink/10" />
          <div className="mt-2 h-3 w-1/2 rounded bg-ink/10" />
        </div>
      ))}
    </div>
  );
}

function AccessDenied({ title, text, onLogin, onHome }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f8ff] p-4 text-ink">
      <div className="w-full max-w-md rounded-md bg-white p-6 text-center shadow-soft">
        <Lock className="mx-auto text-red-600" size={42} aria-hidden="true" />
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

function SupabaseConfigError() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f6f8fb] p-4 text-ink dark:bg-slate-950 dark:text-white">
      <div className="w-full max-w-lg rounded-md border border-amber-200 bg-white p-6 text-center shadow-soft dark:border-amber-300/30 dark:bg-slate-900">
        <AlertTriangle className="mx-auto text-amber-600 dark:text-amber-300" size={42} aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-black">Supabase não configurado.</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65 dark:text-white/65">
          Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel para carregar login, cadastro, reservas e painéis.
        </p>
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
  suggestions,
  setLicenseHistory,
  setProfiles,
  setProperties,
  authProfile,
  supportTickets,
  homeBanners = [],
  setHomeBanners,
  initialView = 'dashboard',
  onSignOut,
  onHome,
  onRefresh,
  addAdminLog,
}) {
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState('');
  const [licenseEdits, setLicenseEdits] = useState({});
  const [userNotice, setUserNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [licenseDraft, setLicenseDraft] = useState({
    owner_id: '',
    property_id: '',
    plan: 'mensal',
    status: 'trial',
    starts_at: format(new Date(), 'yyyy-MM-dd'),
    expires_at: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
    monthly_value: 0,
    property_limit: 1,
    notes: '',
  });
  const [bannerDraft, setBannerDraft] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    storage_path: '',
    link_url: '',
    active: true,
    is_primary: false,
  });

  useEffect(() => {
    setView(initialView || 'dashboard');
  }, [initialView]);

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
    ['suggestions', 'Sugestões', 'forum'],
    ['support', 'Suporte', 'support_agent'],
    ['banners', 'Banners/Home', 'image'],
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
      const { data: savedProfile, error } = await safeSupabaseQuery(
        supabase.rpc('set_profile_role', {
          target_profile_id: profile.id,
          target_role: normalizedRole,
        }),
        authRequestTimeoutMs,
        'Alteracao de permissao excedeu o tempo limite.',
      );
      if (error) {
        setProfiles((current) => current.map((item) => (item.id === profile.id ? profile : item)));
        setUserNotice(`Não foi possível alterar a permissão: ${error.message || 'confira o Supabase.'}`);
        return;
      }
      if (savedProfile) {
        setProfiles((current) => current.map((item) => (item.id === profile.id ? savedProfile : item)));
      }
    }
    setUserNotice(`${profile.email} atualizado para ${roleLabels[normalizedRole] || normalizedRole}.`);
    await addAdminLog('super_admin_role_updated', { user_id: profile.id, email: profile.email, role: normalizedRole });
    await onRefresh?.();
  }

  async function deleteUser(profile) {
    if (!profile?.id) return;
    if (isSuperAdminEmail(profile.email)) {
      setUserNotice('O Super Admin principal não pode ser excluído.');
      return;
    }
    const confirmed = window.confirm('Tem certeza que deseja excluir este usuário?');
    if (!confirmed) return;

    if (hasSupabaseConfig) {
      const { error } = await supabase.functions.invoke('delete-user-cascade', {
        body: { userId: profile.id },
      });
      if (error) {
        setUserNotice(`Não foi possível excluir: ${error.message || 'confira a Edge Function.'}`);
        return;
      }
    }
    setProfiles((current) => current.filter((item) => item.id !== profile.id));
    setProperties((current) => current.filter((item) => item.owner_id !== profile.id));
    setUserNotice('Usuário excluído.');
    await onRefresh?.();
  }

  async function refreshDashboardData() {
    setRefreshing(true);
    setUserNotice('');
    try {
      await onRefresh?.();
      setUserNotice('Dados atualizados.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleBannerFile(event) {
    const file = Array.from(event.target.files || []).find((item) => item.type.startsWith('image/'));
    if (!file) return;
    if (hasSupabaseConfig) {
      const storagePath = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '-')}`;
      const { error } = await supabase.storage.from('home-banners').upload(storagePath, file, {
        cacheControl: '31536000',
        upsert: false,
      });
      if (!error) {
        const { data } = supabase.storage.from('home-banners').getPublicUrl(storagePath);
        setBannerDraft((current) => ({ ...current, image_url: data.publicUrl, storage_path: storagePath }));
        event.target.value = '';
        return;
      }
    }
    const url = await fileToDataUrl(file);
    setBannerDraft((current) => ({ ...current, image_url: url, storage_path: '' }));
    event.target.value = '';
  }

  async function saveBanner(event) {
    event.preventDefault();
    if (!bannerDraft.image_url.trim()) {
      setUserNotice('Adicione uma imagem para salvar o banner.');
      return;
    }
    const payload = {
      ...bannerDraft,
      sort_order: homeBanners.length + 1,
      active: bannerDraft.active !== false,
      is_primary: Boolean(bannerDraft.is_primary),
    };
    let saved = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    if (hasSupabaseConfig) {
      if (payload.is_primary) await supabase.from('home_banners').update({ is_primary: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      const { data, error } = await supabase.from('home_banners').insert(payload).select().maybeSingle();
      if (error) {
        setUserNotice(`Nao foi possivel salvar o banner: ${error.message || 'confira o Supabase.'}`);
        return;
      }
      saved = data;
    }
    setHomeBanners?.((current) => {
      const next = saved.is_primary ? current.map((item) => ({ ...item, is_primary: false })) : current;
      return [...next, saved].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    });
    setBannerDraft({ title: '', subtitle: '', image_url: '', storage_path: '', link_url: '', active: true, is_primary: false });
    setUserNotice('Banner salvo.');
    await addAdminLog('home_banner_saved', { banner_id: saved.id });
  }

  async function updateBanner(banner, updates) {
    const nextBanner = { ...banner, ...updates };
    setHomeBanners?.((current) =>
      current.map((item) =>
        item.id === banner.id ? nextBanner : updates.is_primary ? { ...item, is_primary: false } : item,
      ),
    );
    if (hasSupabaseConfig) {
      if (updates.is_primary) await supabase.from('home_banners').update({ is_primary: false }).neq('id', banner.id);
      await supabase.from('home_banners').update(updates).eq('id', banner.id);
    }
  }

  async function deleteBanner(banner) {
    if (!window.confirm('Tem certeza que deseja remover este banner?')) return;
    setHomeBanners?.((current) => current.filter((item) => item.id !== banner.id));
    if (hasSupabaseConfig) {
      if (banner.storage_path) await supabase.storage.from('home-banners').remove([banner.storage_path]);
      await supabase.from('home_banners').delete().eq('id', banner.id);
    }
    await addAdminLog('home_banner_deleted', { banner_id: banner.id });
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
      try {
        saved = await upsertLicenseRecord(supabase, normalized);
      } catch {
        return;
      }
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
    if (!window.confirm('Tem certeza que deseja excluir esta licença?')) return;
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
    if (hasSupabaseConfig) {
      try {
        await deleteLicenseRecord(supabase, licenseId);
      } catch {
        await onRefresh?.();
        return;
      }
    }
    await addAdminLog('super_admin_license_deleted', { license_id: licenseId });
  }

  return (
    <div className="min-h-screen bg-[#eef4ff] text-ink">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-ink/10 bg-white p-4">
          <div className="flex items-center gap-3 rounded-md bg-ink p-4 text-white">
            <ShieldCheck size={28} />
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
                <PanelIcon icon={icon} size={20} />
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
            <div className="grid gap-2 sm:grid-cols-[auto_minmax(220px,320px)]">
              <Button type="button" variant="outline" onClick={refreshDashboardData} disabled={refreshing} className="min-h-11 px-4">
                <RefreshCw size={18} />
                {refreshing ? 'Atualizando' : 'Atualizar'}
              </Button>
              <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar licenças, proprietários..." />
            </div>
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
            <SuperUsersTable title="Usuários" rows={profiles} notice={userNotice} onRoleChange={updateUserRole} onDeleteUser={deleteUser} />
          ) : null}
          {view === 'owners' ? (
            <SuperUsersTable title="Proprietários" rows={owners} notice={userNotice} onRoleChange={updateUserRole} onDeleteUser={deleteUser} />
          ) : null}
          {view === 'guests' ? (
            <SuperUsersTable title="Hóspedes" rows={guests} notice={userNotice} onRoleChange={updateUserRole} onDeleteUser={deleteUser} />
          ) : null}
          {view === 'reservations' ? (
            <SuperTable title="Reservas" rows={reservations} columns={['guest_name', 'guest_email', 'check_in', 'check_out', 'status']} />
          ) : null}
          {view === 'financial' ? (
            <SuperTable title="Financeiro" rows={cashMovements} columns={['due_date', 'description', 'status', 'payment_method', 'amount']} />
          ) : null}
          {view === 'suggestions' ? (
            <SuperTable title="Sugestões" rows={suggestions || []} columns={['created_at', 'name', 'email', 'message', 'status']} />
          ) : null}
          {view === 'support' ? (
            <SuperTable title="Tickets de suporte" rows={supportTickets || []} columns={['created_at', 'name', 'user_email', 'subject', 'category', 'message', 'status']} />
          ) : null}
          {view === 'banners' ? (
            <div className="grid gap-5">
              <form className="grid gap-4 rounded-md bg-white p-4 shadow-sm" onSubmit={saveBanner}>
                <div>
                  <h2 className="text-xl font-black">Gerenciar banners/home</h2>
                  <p className="mt-1 text-sm text-ink/65">Adicione imagens, defina o banner principal e controle a ordem visual da home.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Titulo">
                    <TextInput value={bannerDraft.title} onChange={(event) => setBannerDraft({ ...bannerDraft, title: event.target.value })} />
                  </Field>
                  <Field label="Link opcional">
                    <TextInput value={bannerDraft.link_url} onChange={(event) => setBannerDraft({ ...bannerDraft, link_url: event.target.value })} placeholder="https://..." />
                  </Field>
                </div>
                <Field label="Subtitulo">
                  <TextArea value={bannerDraft.subtitle} onChange={(event) => setBannerDraft({ ...bannerDraft, subtitle: event.target.value })} />
                </Field>
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <Field label="URL da imagem">
                    <TextInput value={bannerDraft.image_url} onChange={(event) => setBannerDraft({ ...bannerDraft, image_url: event.target.value })} placeholder="https://..." />
                  </Field>
                  <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-ink/15 bg-white px-5 py-2.5 text-sm font-bold shadow-sm">
                    <ImagePlus size={18} />
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={handleBannerFile} />
                  </label>
                </div>
                {bannerDraft.image_url ? (
                  <img className="h-52 w-full rounded-md object-cover" src={bannerDraft.image_url} alt={bannerDraft.title || 'Banner'} />
                ) : null}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={bannerDraft.active} onChange={(event) => setBannerDraft({ ...bannerDraft, active: event.target.checked })} />
                    Ativo
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={bannerDraft.is_primary} onChange={(event) => setBannerDraft({ ...bannerDraft, is_primary: event.target.checked })} />
                    Banner principal
                  </label>
                </div>
                <Button type="submit">
                  <Save size={18} />
                  Salvar banner
                </Button>
              </form>
              <div className="grid gap-3">
                {(homeBanners || []).map((banner) => (
                  <div key={banner.id} className="grid gap-3 rounded-md bg-white p-4 shadow-sm lg:grid-cols-[180px_1fr_auto] lg:items-center">
                    <img className="h-28 w-full rounded-md object-cover" src={banner.image_url} alt={banner.title || 'Banner'} />
                    <div>
                      <p className="font-black">{banner.title || 'Banner sem titulo'}</p>
                      <p className="mt-1 text-sm text-ink/65">{banner.subtitle || 'Sem subtitulo'}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-ink/45">
                        {banner.active ? 'Ativo' : 'Inativo'} {banner.is_primary ? ' - principal' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button type="button" variant="outline" className="px-3" onClick={() => updateBanner(banner, { is_primary: true, active: true })}>
                        Principal
                      </Button>
                      <Button type="button" variant="outline" className="px-3" onClick={() => updateBanner(banner, { active: !banner.active })}>
                        {banner.active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button type="button" variant="outline" className="px-3" onClick={() => deleteBanner(banner)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
                {!homeBanners?.length ? <EmptyState title="Nenhum banner cadastrado" text="Adicione a primeira imagem para a home." /> : null}
              </div>
            </div>
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
                    expires_at: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
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
                      <option value="blocked">Bloqueada</option>
                      <option value="cancelled">Cancelada</option>
                      <option value="inactive">Inativa</option>
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
                  <KeyRound size={18} aria-hidden="true" />
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
                            <option value="blocked">Bloqueada</option>
                            <option value="cancelled">Cancelada</option>
                            <option value="inactive">Inativa</option>
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
                          <Save size={18} aria-hidden="true" />
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
      <PanelIcon icon={icon} className="text-leaf" size={24} />
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

function SuperUsersTable({ title, rows, notice, onRoleChange, onDeleteUser }) {
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
                  <Button type="button" variant="outline" className="px-3" onClick={() => onDeleteUser(profile)}>
                    <Trash2 size={16} />
                    Excluir
                  </Button>
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

function AuthModal({ onClose, onAuthenticated, resolveAuthProfile, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const configNotice = !hasSupabaseConfig
    ? supabaseConfig.isPlaceholder
      ? 'As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ainda estão com valores de exemplo.'
      : 'Cadastro e login precisam das variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build.'
    : '';
  const socialProviders = [
    ['google', 'Google'],
    ['facebook', 'Facebook'],
    ['apple', 'Apple'],
  ];

  useEffect(() => {
    setMode(initialMode || 'login');
  }, [initialMode]);

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
    const { error: resetError } = await safeSupabaseQuery(
      supabase.auth.resetPasswordForEmail(form.email.trim(), {
        redirectTo: getPasswordRecoveryRedirect(),
      }),
      authRequestTimeoutMs,
      'Recuperacao de senha excedeu o tempo limite.',
    );
    if (resetError) {
      if (resetError.code === 'email_address_invalid' || /email.*invalid|invalid.*email/i.test(resetError.message || '')) {
        setError('Informe um e-mail válido para receber a recuperação de senha.');
        return;
      }
      setError('Não foi possível enviar a recuperação de senha agora.');
      return;
    }
    setNotice('Se esse e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);

    try {
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
      const { data, error: signUpError } = await safeSupabaseQuery(
        supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: { full_name: form.full_name, phone: form.phone },
            emailRedirectTo: window.location.origin,
          },
        }),
        10000,
        'Cadastro excedeu o tempo limite. Confira sua conexao e tente novamente.',
      );
      if (signUpError) {
        if (/tempo limite/i.test(signUpError.message || '')) {
          setError('O cadastro demorou demais. Confira sua conexao e tente novamente.');
          return;
        }
        if (isExistingAccountError(signUpError)) {
          setError(existingAccountMessage);
          setNotice('Entre com sua senha ou clique em Recuperar senha para receber um novo link.');
          setMode('login');
          return;
        }
        setError('Não foi possível criar a conta de hóspede. Confira os dados.');
        setSubmitting(false);
        return;
      }
      if (isExistingAccountResponse(data)) {
        setError(existingAccountMessage);
        setNotice('Entre com sua senha ou clique em Recuperar senha para receber um novo link.');
        setMode('login');
        return;
      }
      if (data?.session && data.user) {
        await safeSupabaseQuery(
          supabase.from('profiles').upsert({
            id: data.user.id,
            email: form.email.trim(),
            full_name: form.full_name,
            phone: form.phone,
            role: 'hospede',
          }),
          profileRequestTimeoutMs,
          'Cadastro criado, mas o perfil demorou para salvar.',
        );
      }
      if (data?.session) {
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

    const { data, error: signInError } = await safeSupabaseQuery(
      supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      }),
      authRequestTimeoutMs,
      'Login excedeu o tempo limite. Confira sua conexao e tente novamente.',
    );
    if (/tempo limite/i.test(signInError?.message || '')) {
      setError('O login demorou demais. Confira sua conexao e tente novamente.');
      return;
    }
    if (signInError?.message === 'Email not confirmed') {
      setError('Confirme seu email antes de entrar.');
      setNotice('Verifique sua caixa de entrada e tente novamente.');
      setSubmitting(false);
      return;
    }
    if (signInError || !data?.session) {
      setError('Email ou senha incorretos.');
      setSubmitting(false);
      return;
    }
    const profile = await resolveAuthProfile(data.session);
    onAuthenticated(profile);
    setSubmitting(false);
    } catch {
      setError('Nao foi possivel concluir agora. Confira sua conexao e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur">
      <form className="brand-card grid w-full max-w-md rounded-md bg-white p-5 text-ink shadow-soft sm:max-w-lg sm:p-6" onSubmit={submit}>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose} aria-label="Fechar login" className="min-h-9 px-3 py-1.5">
            <X size={16} />
          </Button>
        </div>
        <div className="grid justify-items-center gap-2 text-center">
          <BrandLogo variant="vertical" className="h-28 w-28 rounded-2xl shadow-sm" />
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
            {configNotice}
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
            {mode === 'login' ? <Lock size={18} /> : <UserPlus size={18} />}
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
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!hasSupabaseConfig) {
      setError('Recuperação de senha precisa do Supabase configurado.');
      return;
    }
    if (password.length < 6) {
      setError('Use uma senha com pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionData, error: sessionError } = await safeSupabaseQuery(
        supabase.auth.getSession(),
        profileRequestTimeoutMs,
        'Validacao do link excedeu o tempo limite.',
      );
      if (sessionError || !sessionData?.session) {
        setError('Abra o link de recuperação enviado por e-mail antes de criar a nova senha.');
        return;
      }
      const { error: updateError } = await safeSupabaseQuery(
        supabase.auth.updateUser({ password }),
        authRequestTimeoutMs,
        'Alteracao de senha excedeu o tempo limite.',
      );
      if (updateError) {
        setError('Não foi possível alterar a senha agora. Solicite um novo link e tente novamente.');
        return;
      }
      setPassword('');
      setConfirmPassword('');
      setMessage('Senha alterada. Você já pode entrar normalmente.');
    } catch {
      setError('Não foi possível alterar a senha agora. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/60 p-4 backdrop-blur">
      <form className="w-full max-w-md rounded-md bg-white p-5 text-ink shadow-soft dark:bg-slate-900 dark:text-white" onSubmit={submit}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo variant="mark" className="h-14 w-14 rounded-xl shadow-sm" />
            <div>
            <h2 className="text-2xl font-black">Criar nova senha</h2>
              <p className="mt-1 text-sm text-ink/65 dark:text-white/65">Defina uma nova senha para acessar sua conta.</p>
            </div>
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
          <Button type="submit" disabled={submitting}>
            <Save size={18} />
            {submitting ? 'Salvando...' : 'Salvar nova senha'}
          </Button>
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-leaf">{message}</p> : null}
        </div>
      </form>
    </div>
  );
}

function ClientPortal({ authProfile, reservations, properties, onUpdateProfile, voucherSummary, onClose, onSignOut, initialView = 'dashboard' }) {
  const clientReservations = reservations
    .filter((reservation) => reservation.guest_email === authProfile?.email)
    .sort((a, b) => String(b.created_at || b.check_in).localeCompare(String(a.created_at || a.check_in)));
  const currentReservation = clientReservations.find((reservation) => ['pending', 'confirmed'].includes(reservation.status));
  const [view, setView] = useState(initialView);
  const [profileDraft, setProfileDraft] = useState({
    full_name: authProfile?.full_name || '',
    phone: authProfile?.phone || '',
  });
  const [profileNotice, setProfileNotice] = useState('');
  const [supportDraft, setSupportDraft] = useState({ subject: '', category: 'duvida', message: '' });
  const [supportNotice, setSupportNotice] = useState('');
  const pendingReservations = clientReservations.filter((reservation) => reservation.status === 'pending');
  const confirmedReservations = clientReservations.filter((reservation) => reservation.status === 'confirmed');
  const cancelledReservations = clientReservations.filter((reservation) => reservation.status === 'cancelled');
  const menu = [
    ['dashboard', 'Dashboard', 'dashboard'],
    ['reservations', 'Minhas reservas', 'calendar_month'],
    ['support', 'Suporte', 'support_agent'],
    ['settings', 'Configurações', 'settings'],
    ['profile', 'Dados pessoais', 'person'],
    ['status', 'Status atual', 'verified_user'],
  ];

  useEffect(() => {
    setView(initialView || 'dashboard');
  }, [initialView]);

  async function submitProfile(event) {
    event.preventDefault();
    await onUpdateProfile(profileDraft);
    setProfileNotice('Dados pessoais atualizados.');
  }

  async function submitSupport(event) {
    event.preventDefault();
    setSupportNotice('');
    const payload = {
      user_id: authProfile?.id || null,
      user_email: authProfile?.email || '',
      name: authProfile?.full_name || '',
      subject: supportDraft.subject,
      category: supportDraft.category,
      message: supportDraft.message,
      status: 'new',
    };
    try {
      if (hasSupabaseConfig) {
        const { error } = await supabase.from('support_tickets').insert(payload);
        if (error) throw error;
      }
      setSupportDraft({ subject: '', category: 'duvida', message: '' });
      setSupportNotice('Suporte enviado com sucesso.');
    } catch {
      setSupportNotice('Não foi possível enviar agora. Tente novamente.');
    }
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
                <PanelIcon icon={icon} size={18} />
                {label}
              </button>
            ))}
          </nav>
          <Button type="button" variant="outline" onClick={onSignOut} className="mt-5 w-full">
            <LogOut size={18} />
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
                <PortalCard label="Reservas" value={clientReservations.length} icon="calendar_month" />
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
                  <Button type="button" variant="outline" onClick={() => setView('reservations')}>
                    Ver reservas
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {view === 'reservations' ? (
            <div className="grid gap-4">
              <div>
                <h3 className="text-2xl font-black">
                  Histórico de reservas
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
          {view === 'support' ? (
            <div className="grid gap-4">
              <h3 className="text-2xl font-black">Suporte</h3>
              <form className="grid gap-4 rounded-md bg-white p-4 shadow-sm" onSubmit={submitSupport}>
                <Field label="Assunto">
                  <TextInput value={supportDraft.subject} onChange={(event) => setSupportDraft({ ...supportDraft, subject: event.target.value })} required />
                </Field>
                <Field label="Categoria">
                  <SelectInput value={supportDraft.category} onChange={(event) => setSupportDraft({ ...supportDraft, category: event.target.value })}>
                    <option value="erro">Erro</option>
                    <option value="duvida">Dúvida</option>
                    <option value="sugestao">Sugestão</option>
                  </SelectInput>
                </Field>
                <Field label="Mensagem">
                  <TextArea value={supportDraft.message} onChange={(event) => setSupportDraft({ ...supportDraft, message: event.target.value })} required />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {supportNotice ? <p className="text-sm font-semibold text-leaf">{supportNotice}</p> : <span />}
                  <Button type="submit">
                    <LifeBuoy size={18} />
                    Enviar suporte
                  </Button>
                </div>
              </form>
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
        <Mail size={18} aria-hidden="true" />
        {status === 'loading' ? 'Enviando...' : 'Enviar sugestão'}
      </Button>
      {status === 'success' ? <p className="text-sm font-semibold text-green-700">Sugestão enviada com sucesso.</p> : null}
      {status === 'error' ? <p className="text-sm font-semibold text-red-700">Não foi possível enviar agora.</p> : null}
    </form>
  );
}

function PortalCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-white p-4 shadow-sm">
      <PanelIcon icon={Icon} className="text-leaf" size={20} />
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
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-md bg-mist text-leaf dark:bg-white/10 dark:text-blue-300">
        <PanelIcon icon={Icon} size={20} />
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
  return (
    <div className="rounded-md bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-mist text-leaf">
          <PanelIcon icon={Icon} size={18} />
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
  addCashMovement,
  reservations,
  saveProperty,
  savePaymentSettings,
  updateReservationDetails,
  updateReservationStatus,
  initialView = 'dashboard',
}) {
  const [login, setLogin] = useState({ email: adminEmail, password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [expandedReservationId, setExpandedReservationId] = useState('');
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [reportType, setReportType] = useState('summary');
  const [adminView, setAdminView] = useState(initialView);
  const [adminNotice, setAdminNotice] = useState('');
  const [licenseNotice, setLicenseNotice] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
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
  const [cashDraft, setCashDraft] = useState({
    type: 'income',
    amount: '',
    payment_method: 'pix',
    status: 'received',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
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
    setAdminView(initialView || 'dashboard');
  }, [initialView]);

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
    const { data: savedProfile, error } = await safeSupabaseQuery(
      supabase.rpc('set_profile_role', {
        target_profile_id: profile.id,
        target_role: normalizeRole(role),
      }),
      authRequestTimeoutMs,
      'Alteracao de permissao excedeu o tempo limite.',
    );
    if (error) {
      setAdminUserNotice(`Não foi possível atualizar esse usuário: ${error.message || 'confira o Supabase.'}`);
      return;
    }
    setAdminUsers((current) => current.map((item) => (item.id === profile.id ? savedProfile || { ...item, role } : item)));
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

  async function copyPropertyLink(propertyItem) {
    const origin = typeof window === 'undefined' ? 'https://hospedex.com.br' : window.location.origin;
    const link = `${origin}${propertyPath(propertyItem)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyNotice('Link copiado!');
    } catch {
      setCopyNotice(link);
    }
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
    const created = await createManualReservation(manualReservation, property);
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

  async function submitCashMovement(event) {
    event.preventDefault();
    await addCashMovement(cashDraft, property.id);
    setCashDraft({
      type: 'income',
      amount: '',
      payment_method: 'pix',
      status: 'received',
      due_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
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

  const ownerAccessState = getOwnerPanelAccessState({
    role: normalizeRole(authProfile?.role),
    license: propertyLicense,
    licenseIsValid: propertyLicense ? isLicenseAccessValid(propertyLicense) : false,
  });
  const ownerPanelBlocked = adminUnlocked && ownerAccessState.blocked;
  const licenseWarningText =
    normalizeRole(authProfile?.role) === 'proprietario' && propertyLicense && isLicenseAccessValid(propertyLicense)
      ? buildLicenseWarningText(propertyLicense)
      : '';
  const licenseWarningKey = propertyLicense
    ? `license-warning:${propertyLicense.id || propertyLicense.license_key}:${propertyLicense.expires_at || ''}`
    : '';
  const [dismissedLicenseWarning, setDismissedLicenseWarning] = useState(() =>
    licenseWarningKey ? readLocalData(licenseWarningKey, false) : false,
  );

  useEffect(() => {
    setDismissedLicenseWarning(licenseWarningKey ? readLocalData(licenseWarningKey, false) : false);
  }, [licenseWarningKey]);

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
                  <h3 className="text-2xl font-black">
                    {propertyLicense ? `Licenca ${licenseStatusLabels[normalizeLicenseStatus(propertyLicense)]}` : 'Aguardando liberacao da licenca'}
                  </h3>
                  <p className="mt-2 text-sm leading-6">
                    O painel do proprietario esta bloqueado ate a regularizacao da licenca. Os dados continuam salvos e voltam a ficar
                    disponiveis quando o Super Admin liberar uma licenca ativa.
                  </p>
                  <p className="mt-3 text-sm font-bold">Vencimento: {propertyLicense?.expires_at || '-'}</p>
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
                    <PanelIcon icon={icon} size={18} />
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
            {licenseWarningText && !dismissedLicenseWarning ? (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 shrink-0" />
                  <div>
                    <h3 className="font-black">Aviso de licenca</h3>
                    <p className="mt-1 text-sm font-semibold">{licenseWarningText}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDismissedLicenseWarning(true);
                    if (licenseWarningKey) writeLocalData(licenseWarningKey, true);
                  }}
                >
                  Entendi
                </Button>
              </section>
            ) : null}
            {normalizeRole(authProfile?.role) !== 'super_admin' && propertyLicense && !isLicenseAccessValid(propertyLicense) ? (
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
              {copyNotice ? <p className="rounded-md bg-leaf/10 px-3 py-2 text-sm font-bold text-leaf">{copyNotice}</p> : null}
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
                        onClick={() => {
                          if (typeof window !== 'undefined') window.location.href = propertyPath(item);
                        }}
                      >
                        <Home size={16} />
                        Ver página
                      </Button>
                      <Button type="button" variant="outline" className="px-3" onClick={() => copyPropertyLink(item)}>
                        <Copy size={16} />
                        Copiar link
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="px-3"
                        onClick={() => deleteProperty(item.id)}
                        aria-label={`Excluir ${item.name}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
                {!properties.length ? (
                  <div className="rounded-md border border-dashed border-ink/20 bg-[#f4f8ff] p-5 text-center">
                    <p className="font-black">Nenhuma casa cadastrada</p>
                    <p className="mt-2 text-sm text-ink/60">Adicione sua primeira casa quando a licenca estiver ativa.</p>
                    <Button type="button" className="mt-4" onClick={startNewProperty}>
                      <Plus size={18} />
                      Adicionar casa
                    </Button>
                  </div>
                ) : null}
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
              <form className="grid gap-4 rounded-md bg-[#f4f8ff] p-4 shadow-sm" onSubmit={submitCashMovement}>
                <h4 className="font-black">Adicionar movimentação</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tipo">
                    <SelectInput value={cashDraft.type} onChange={(event) => setCashDraft({ ...cashDraft, type: event.target.value })}>
                      <option value="income">Receita</option>
                      <option value="expense">Despesa</option>
                    </SelectInput>
                  </Field>
                  <Field label="Valor">
                    <TextInput type="number" value={cashDraft.amount} onChange={(event) => setCashDraft({ ...cashDraft, amount: event.target.value })} required />
                  </Field>
                  <Field label="Forma pagamento">
                    <SelectInput value={cashDraft.payment_method} onChange={(event) => setCashDraft({ ...cashDraft, payment_method: event.target.value })}>
                      <option value="pix">Pix</option>
                      <option value="card">Cartão</option>
                      <option value="transfer">Transferência</option>
                      <option value="cash">Dinheiro</option>
                      <option value="check">Cheque</option>
                    </SelectInput>
                  </Field>
                  <Field label="Status">
                    <SelectInput value={cashDraft.status} onChange={(event) => setCashDraft({ ...cashDraft, status: event.target.value })}>
                      <option value="received">Já recebeu</option>
                      <option value="expected">A receber</option>
                    </SelectInput>
                  </Field>
                  <Field label="Data">
                    <TextInput type="date" value={cashDraft.due_date} onChange={(event) => setCashDraft({ ...cashDraft, due_date: event.target.value })} />
                  </Field>
                  <Field label="Descrição">
                    <TextInput value={cashDraft.description} onChange={(event) => setCashDraft({ ...cashDraft, description: event.target.value })} required />
                  </Field>
                </div>
                <Button type="submit" variant="secondary">
                  <Plus size={18} />
                  Adicionar movimentação
                </Button>
              </form>
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
                        disabled={!isOwnerAdmin}
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
                {isOwnerAdmin ? (
                  <div className="flex justify-end">
                    <Button type="button" onClick={() => saveInterestRates(interestRates)}>
                      <Save size={18} />
                      Salvar juros
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-md bg-[#f4f8ff] p-3 text-sm font-semibold text-ink/65">
                    Juros definidos pelo Super Admin. Proprietarios podem visualizar, mas nao alterar.
                  </p>
                )}
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
