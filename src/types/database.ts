/**
 * Hand-written types matching supabase/migrations/*.sql (Module 1).
 *
 * These are plain row-shape interfaces, not full Supabase-generated
 * Database/Insert/Update/Relationships types — the project isn't CLI-linked
 * to the remote database (see supabase/README.md), so codegen isn't
 * available yet. If/when the project is linked, `supabase gen types
 * typescript` can replace this file with a fully generated one without
 * changing how it's imported elsewhere, as long as these names are kept.
 */

export type UUID = string;
export type ISODateTime = string;

export type UserRole = "customer" | "admin" | "staff" | "production";

export interface Profile {
  id: UUID;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Address {
  id: UUID;
  customer_id: UUID;
  label: string | null;
  recipient_name: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postal_code: string;
  country: string;
  phone: string | null;
  is_default: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ---- Catalog -----------------------------------------------------------

export interface Category {
  id: UUID;
  parent_id: UUID | null;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type Collection = {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  published_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
};

export type ProductStatus = "draft" | "published" | "archived";

export interface Product {
  id: UUID;
  category_id: UUID | null;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  base_price: number;
  currency: string;
  status: ProductStatus;
  is_featured: boolean;
  published_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ProductImage {
  id: UUID;
  product_id: UUID;
  url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: ISODateTime;
}

export interface ProductCollection {
  product_id: UUID;
  collection_id: UUID;
  created_at: ISODateTime;
}

// ---- Builder -------------------------------------------------------------

interface BuilderOptionBase {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  price_adjustment: number;
  is_active: boolean;
  sort_order: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type Fabric = BuilderOptionBase;
export type EmbroideryType = BuilderOptionBase;
export type SleeveStyle = BuilderOptionBase;
export type Neckline = BuilderOptionBase;
export type DupattaOption = BuilderOptionBase;

export interface Colour extends Omit<BuilderOptionBase, "description"> {
  hex_value: string | null;
}

export type BuilderConfigurationStatus = "draft" | "submitted";

export interface BuilderConfiguration {
  id: UUID;
  customer_id: UUID | null;
  product_id: UUID | null;
  fabric_id: UUID | null;
  embroidery_type_id: UUID | null;
  colour_id: UUID | null;
  sleeve_style_id: UUID | null;
  neckline_id: UUID | null;
  dupatta_option_id: UUID | null;
  custom_notes: string | null;
  estimated_price: number | null;
  status: BuilderConfigurationStatus;
  share_token: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface InspirationImage {
  id: UUID;
  builder_configuration_id: UUID;
  uploaded_by: UUID | null;
  storage_path: string;
  url: string;
  created_at: ISODateTime;
}

// ---- Measurements ----------------------------------------------------

export type MeasurementUnit = "cm" | "inch";
export type MeasurementProfileStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "correction_requested";

export interface MeasurementProfile {
  id: UUID;
  customer_id: UUID;
  label: string;
  unit: MeasurementUnit;
  status: MeasurementProfileStatus;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Measurement {
  id: UUID;
  measurement_profile_id: UUID;
  field_key: string;
  value: number;
  created_at: ISODateTime;
}

// ---- Wishlist & cart ---------------------------------------------------

export interface WishlistItem {
  id: UUID;
  customer_id: UUID;
  product_id: UUID;
  created_at: ISODateTime;
}

export type CartStatus = "active" | "converted" | "abandoned";

export interface Cart {
  id: UUID;
  customer_id: UUID | null;
  session_id: string | null;
  status: CartStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface CartItem {
  id: UUID;
  cart_id: UUID;
  product_id: UUID | null;
  builder_configuration_id: UUID | null;
  quantity: number;
  unit_price_snapshot: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ---- Enquiries, quotations, appointments ------------------------------

export type EnquiryType = "builder" | "consultation" | "general";
export type EnquiryStatus = "new" | "in_review" | "quoted" | "closed";

export interface Enquiry {
  id: UUID;
  customer_id: UUID | null;
  builder_configuration_id: UUID | null;
  type: EnquiryType;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  message: string | null;
  status: EnquiryStatus;
  assigned_admin_id: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface Quotation {
  id: UUID;
  enquiry_id: UUID;
  customer_id: UUID | null;
  estimated_price: number | null;
  /** Final Admin Quote — authoritative price, immutable once accepted. */
  quoted_price: number;
  currency: string;
  deposit_amount: number | null;
  deposit_percentage: number | null;
  valid_until: ISODateTime | null;
  status: QuotationStatus;
  notes: string | null;
  created_by: UUID | null;
  accepted_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type AppointmentType = "consultation" | "fitting" | "other";
export type AppointmentStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  id: UUID;
  customer_id: UUID | null;
  type: AppointmentType;
  scheduled_at: ISODateTime;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ---- Orders & payments ---------------------------------------------------

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in_production"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Order {
  id: UUID;
  order_number: string;
  customer_id: UUID;
  quotation_id: UUID | null;
  measurement_profile_id: UUID | null;
  shipping_address_id: UUID | null;
  status: OrderStatus;
  subtotal: number;
  deposit_amount: number;
  deposit_paid_amount: number;
  balance_due_amount: number;
  total_amount: number;
  currency: string;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface OrderItem {
  id: UUID;
  order_id: UUID;
  product_id: UUID | null;
  builder_configuration_id: UUID | null;
  description_snapshot: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: ISODateTime;
}

export type PaymentType = "deposit" | "balance" | "full" | "refund";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type PaymentProvider = "stripe" | "paypal" | "manual";

export interface Payment {
  id: UUID;
  order_id: UUID;
  type: PaymentType;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  provider_reference: string | null;
  paid_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface PaymentTransaction {
  id: UUID;
  payment_id: UUID;
  provider_event_type: string | null;
  raw_payload: unknown;
  created_at: ISODateTime;
}

// ---- Production & shipping ---------------------------------------------

export type ProductionStatus =
  | "order_confirmed"
  | "measurements_verified"
  | "design_approved"
  | "materials_prepared"
  | "cutting"
  | "embroidery"
  | "stitching"
  | "finishing"
  | "quality_check"
  | "ready_for_dispatch"
  | "shipped"
  | "delivered";

export interface ProductionOrder {
  id: UUID;
  order_id: UUID;
  current_status: ProductionStatus;
  assigned_team: string | null;
  estimated_completion_date: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ProductionStatusHistoryEntry {
  id: UUID;
  production_order_id: UUID;
  status: string;
  note: string | null;
  changed_by: UUID | null;
  created_at: ISODateTime;
}

export type ShippingStatus =
  | "pending"
  | "label_created"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception";

export interface ShippingOrder {
  id: UUID;
  order_id: UUID;
  address_id: UUID | null;
  courier: string | null;
  tracking_number: string | null;
  status: ShippingStatus;
  shipping_cost: number | null;
  shipped_at: ISODateTime | null;
  delivered_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ShippingEvent {
  id: UUID;
  shipping_order_id: UUID;
  status: string;
  description: string | null;
  occurred_at: ISODateTime;
  created_at: ISODateTime;
}

// ---- Notifications & reviews --------------------------------------------

export type NotificationChannel = "email" | "whatsapp" | "in_app" | "sms";

export interface Notification {
  id: UUID;
  profile_id: UUID;
  type: string;
  title: string;
  body: string | null;
  channel: NotificationChannel;
  read_at: ISODateTime | null;
  metadata: unknown;
  created_at: ISODateTime;
}

export interface Review {
  id: UUID;
  customer_id: UUID;
  order_id: UUID | null;
  product_id: UUID | null;
  rating: number;
  title: string | null;
  body: string | null;
  is_published: boolean;
  is_featured: boolean;
  admin_response: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ReviewMedia {
  id: UUID;
  review_id: UUID;
  url: string;
  type: "image" | "video";
  created_at: ISODateTime;
}

// ---- Marketing & loyalty -------------------------------------------------

export type CouponType = "percentage" | "fixed";

export interface Coupon {
  id: UUID;
  code: string;
  type: CouponType;
  value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  starts_at: ISODateTime | null;
  expires_at: ISODateTime | null;
  is_active: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Referral {
  id: UUID;
  referrer_customer_id: UUID;
  referred_customer_id: UUID | null;
  code: string;
  status: "pending" | "completed";
  reward_amount: number | null;
  created_at: ISODateTime;
  completed_at: ISODateTime | null;
}

export interface LoyaltyAccount {
  id: UUID;
  customer_id: UUID;
  points_balance: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface LoyaltyTransaction {
  id: UUID;
  loyalty_account_id: UUID;
  type: "earn" | "redeem" | "adjust";
  points: number;
  reference: string | null;
  created_at: ISODateTime;
}

// ---- Content, SEO, media -------------------------------------------------

export type ContentStatus = "draft" | "published";

export interface BlogPost {
  id: UUID;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  author_id: UUID | null;
  status: ContentStatus;
  published_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Page {
  id: UUID;
  title: string;
  slug: string;
  content: string | null;
  status: ContentStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Media {
  id: UUID;
  uploader_id: UUID | null;
  storage_path: string;
  url: string;
  file_type: string | null;
  size_bytes: number | null;
  alt_text: string | null;
  created_at: ISODateTime;
}

export interface SeoMetadata {
  id: UUID;
  entity_type: string;
  entity_id: UUID;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ---- Analytics, audit, settings ------------------------------------------

export interface AnalyticsEvent {
  id: UUID;
  event_name: string;
  profile_id: UUID | null;
  session_id: string | null;
  properties: unknown;
  occurred_at: ISODateTime;
  created_at: ISODateTime;
}

export interface AuditLog {
  id: UUID;
  actor_id: UUID | null;
  action: string;
  entity_type: string | null;
  entity_id: UUID | null;
  before: unknown;
  after: unknown;
  created_at: ISODateTime;
}

export interface SiteSetting {
  key: string;
  value: unknown;
  updated_at: ISODateTime;
  updated_by: UUID | null;
}
