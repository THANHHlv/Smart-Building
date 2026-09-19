export interface DashboardOverview {
  total_buildings: number;
  total_apartments: number;
  total_devices: number;
  devices_online: number;
  devices_offline: number;
  total_readings_today: number;
  total_alerts_open: number;
}

export interface EnergyDashboard {
  total_kwh_today: number;
  total_kwh_this_month: number;
  avg_kwh_per_apartment: number;
  readings?: any[];
}

export interface WaterDashboard {
  total_liters_today: number;
  total_liters_this_month: number;
  avg_liters_per_apartment: number;
  readings?: any[];
}

export interface Device {
  id: string;
  apartment_id: string;
  device_type_id: string;
  device_code: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR';
  installed_at: string | null;
  last_seen_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  device_id: string | null;
  apartment_id: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  message: string | null;
  source: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SimulationTickResponse {
  readings_generated: number;
  timestamp: string;
  message: string;
}

export interface AnomalyResponse {
  anomaly_type: string;
  device_id: string;
  device_name: string;
  metric: string;
  value: number;
  unit: string;
  alert_title: string;
  alert_severity: string;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  description: string | null;
  total_floors: number;
  is_active: boolean;
}

// --- Auth & Role Types ---
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'resident';
  apartment_id: string | null;
  apartment_unit: string | null;
  building_name: string | null;
  is_active: boolean;
}

export interface DemoAccount {
  email: string;
  role: 'admin' | 'resident';
  label: string;
  description: string;
  apartment_unit: string | null;
  building_name: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

// --- Resident Dashboard Types ---
export interface ApartmentInfo {
  id: string;
  unit_number: string;
  floor_number: number;
  building_name: string;
  building_address: string;
  area_sqm: number | null;
  num_rooms: number | null;
  resident_name: string | null;
}

export interface IndoorClimate {
  temperature_celsius: number | null;
  humidity_percent: number | null;
  status: string;
  last_updated: string | null;
}

export interface TelemetryPoint {
  timestamp: string;
  value: number;
}

export interface EnergyMetrics {
  today_kwh: number;
  month_kwh: number;
  current_kw: number;
  recent_readings: TelemetryPoint[];
}

export interface WaterMetrics {
  today_liters: number;
  month_liters: number;
  current_flow_l_min: number;
  recent_readings: TelemetryPoint[];
}

export interface ResidentDevice {
  id: string;
  device_code: string;
  name: string;
  device_type_code: string;
  status: string;
  last_reading_value: number | null;
  last_reading_unit: string | null;
  last_seen_at: string | null;
}

export interface ResidentAlert {
  id: string;
  title: string;
  message: string | null;
  severity: string;
  status: string;
  created_at: string;
}

export interface EstimatedUtilityCost {
  electricity_cost_vnd: number;
  electricity_vat_vnd: number;
  water_cost_vnd: number;
  total_estimated_vnd: number;
  electricity_tier: string;
  avg_comparison_percent: number;
  billing_cycle: string;
}

export interface ResidentDashboardResponse {
  apartment: ApartmentInfo;
  climate: IndoorClimate;
  energy: EnergyMetrics;
  water: WaterMetrics;
  devices: ResidentDevice[];
  alerts: ResidentAlert[];
  estimated_cost?: EstimatedUtilityCost | null;
}

// --- Admin User Management Types ---
export interface UserAdminItem {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  apartment_id: string | null;
  apartment_unit: string | null;
  building_name: string | null;
  floor_number: number | null;
  created_at: string;
}

// --- Maintenance & Support Ticket Types ---
export interface MaintenanceTicket {
  id: string;
  apartment_id: string;
  apartment_unit?: string | null;
  building_name?: string | null;
  user_id?: string | null;
  resident_name?: string | null;
  title: string;
  description: string;
  category: string;
  urgency: string;
  status: string;
  technician_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

// --- AI Assistant Types ---
export interface AiSuggestedAction {
  label: string;
  action_type: string;
  target?: string | null;
  data?: any;
}

export interface AiQueryResponse {
  reply: string;
  role_context: string;
  confidence_score: number;
  suggested_actions: AiSuggestedAction[];
  timestamp: string;
}

// --- Payment & Billing Types ---

export interface InvoiceItem {
  id: string;
  service_type: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  metadata_json: Record<string, any> | null;
}

export interface TransactionRecord {
  id: string;
  provider: string;
  provider_txn_id: string | null;
  amount: number;
  currency: string;
  status: string;
  provider_response_code: string | null;
  provider_message: string | null;
  created_at: string;
}

export interface InvoiceListItem {
  id: string;
  invoice_number: string;
  apartment_id: string;
  total_amount: number;
  currency: string;
  status: string;
  due_date: string;
  paid_at: string | null;
  created_at: string;
}

export interface InvoiceDetail extends InvoiceListItem {
  billing_cycle_id: string;
  notes: string | null;
  updated_at: string;
  items: InvoiceItem[];
  transactions: TransactionRecord[];
}

export interface PayInvoiceResponse {
  transaction_id: string;
  payment_url: string;
  provider: string;
}

export interface PaymentMethod {
  id: string;
  provider: string;
  display_name: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ServiceCatalogItem {
  code: string;
  name: string;
  description: string;
  unit: string | null;
  unit_price: number | null;
  is_metered: boolean;
}

// --- My Services API Types ---
export interface MyServiceItem {
  id: string;
  name: string;
  service_type: string;
  is_recurring: boolean;
  status: string;
  started_at: string;
  auto_pay_enabled: boolean;
  unit: string;
  default_price: number | null;
}

export interface InvoiceSummary {
  total_overdue: number;
  total_due_soon: number;
  total_unpaid: number;
  overdue_count: number;
  due_soon_count: number;
  nearest_due_date: string | null;
}

export interface BreakdownItem {
  service_type: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
  formula: string | null;
}

export interface InvoiceBreakdownResponse {
  invoice_id: string;
  invoice_number: string;
  status: string;
  due_date: string;
  total_amount: number;
  items: BreakdownItem[];
}

export interface ManualConfirmRequest {
  method: string;
  note?: string;
}

export interface ReminderSettingsRequest {
  app_enabled: boolean;
  zalo_enabled: boolean;
  sms_enabled: boolean;
}

// --- Notification Service Types ---
export type NotificationCategory = 'billing' | 'alert' | 'announcement' | 'maintenance';
export type NotificationChannel = 'in_app' | 'push' | 'sms' | 'zalo' | 'email';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface ResidentNotification {
  id: string;
  user_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  created_at: string;
  read_at: string | null;
  data_json?: string | null;
}

export interface NotificationListResponse {
  items: ResidentNotification[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface NotificationPreferenceItem {
  category: NotificationCategory;
  channel: NotificationChannel;
  is_enabled: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferenceItem[];
}

// --- Ticket & Work Order Types ---
export type TicketSource = 'ai_anomaly' | 'resident_report' | 'manual_admin';
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
export type TicketCategory = 'electrical' | 'plumbing' | 'elevator' | 'hvac' | 'security' | 'other';

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_url: string;
  file_name: string;
  file_size?: number | null;
  content_type?: string | null;
  uploaded_by?: string | null;
  uploaded_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id?: string | null;
  author_name?: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketStatusHistory {
  id: string;
  ticket_id: string;
  from_status: string;
  to_status: string;
  changed_by?: string | null;
  changed_by_name?: string | null;
  changed_at: string;
  note?: string | null;
}

export interface Technician {
  id: string;
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  specialties: string[];
  is_active: boolean;
  open_ticket_count: number;
}

export interface Ticket {
  id: string;
  source: TicketSource;
  apartment_id?: string | null;
  apartment_unit?: string | null;
  building_name?: string | null;
  device_id?: string | null;
  device_code?: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  description: string;
  created_by?: string | null;
  created_by_name?: string | null;
  assigned_to?: string | null;
  assigned_technician_name?: string | null;
  created_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
  due_at?: string | null;
  is_overdue: boolean;
  due_in_human?: string | null;
  resident_rating?: number | null;
  resident_feedback?: string | null;
}

export interface TicketDetail extends Ticket {
  attachments: TicketAttachment[];
  comments: TicketComment[];
  status_history: TicketStatusHistory[];
  technician?: Technician | null;
}

export interface CategorySlaStat {
  category: string;
  category_name: string;
  total_tickets: number;
  resolved_tickets: number;
  avg_resolution_hours: number;
  sla_target_hours: number;
  sla_compliance_rate_percent: number;
  overdue_tickets: number;
}

export interface SlaReport {
  month: string;
  total_tickets: number;
  total_resolved: number;
  overall_avg_resolution_hours: number;
  overall_compliance_rate_percent: number;
  categories: CategorySlaStat[];
}

// --- Admin Operations Dashboard & RBAC Types ---

export interface ServiceRevenueItem {
  service_type: string;
  service_name: string;
  amount_vnd: number;
  percentage: number;
}

export interface AdminDashboardOverview {
  total_apartments: number;
  occupied_apartments: number;
  occupancy_rate_percent: number;
  active_tickets_count: number;
  overdue_tickets_count: number;
  avg_ticket_resolution_hours: number;
  unpaid_invoices_count: number;
  total_unpaid_amount_vnd: number;
  total_revenue_this_month_vnd: number;
  revenue_by_service: ServiceRevenueItem[];
  total_devices: number;
  devices_online: number;
  devices_offline: number;
  offline_summary_text: string;
}

export interface CollectionRateMonth {
  month: string;
  total_billed_vnd: number;
  total_collected_vnd: number;
  collection_rate_percent: number;
  on_time_rate_percent: number;
  invoices_count: number;
  paid_count: number;
}

export interface CollectionRateResponse {
  current_month: CollectionRateMonth;
  previous_month?: CollectionRateMonth | null;
  month_over_month_change_percent: number;
  history: CollectionRateMonth[];
}

export interface OverdueApartmentItem {
  apartment_id: string;
  apartment_unit: string;
  floor_number?: number | null;
  building_name: string;
  resident_name?: string | null;
  resident_email?: string | null;
  unpaid_invoices_count: number;
  total_overdue_amount_vnd: number;
  oldest_due_date: string;
  days_overdue: number;
}

export interface FloorDeviceHealth {
  floor_number: number;
  building_name: string;
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  maintenance_needed: boolean;
  summary_text: string;
}

export interface DeviceHealthResponse {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  overall_health_percent: number;
  floors: FloorDeviceHealth[];
}

export interface PermissionItem {
  id: string;
  code: string;
  description?: string | null;
  module: string;
}

export interface RoleItem {
  id: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  permissions: string[];
}

export interface UserRoleAssignmentItem {
  id: string;
  role_id: string;
  role_name: string;
  role_description?: string | null;
  building_id?: string | null;
  building_name?: string | null;
  granted_at: string;
}

export interface UserWithRolesResponse {
  id: string;
  email: string;
  full_name?: string | null;
  legacy_role: string;
  is_active: boolean;
  apartment_id?: string | null;
  apartment_unit?: string | null;
  building_name?: string | null;
  roles: UserRoleAssignmentItem[];
  created_at: string;
}

// -----------------------------------------------------------------------------
// Priority 4: Self-Service Requests, Amenities & Community Bulletin Board
// -----------------------------------------------------------------------------

export type ServiceRequestType = 'cleaning' | 'periodic_maintenance' | 'vehicle_registration' | 'access_card' | 'other';

export interface ServiceRequest {
  id: string;
  ticket_id: string;
  request_type: ServiceRequestType | string;
  scheduled_at?: string | null;
  scheduled_slot?: string | null;
  notes: Record<string, any>;
  created_at: string;
  updated_at: string;
  ticket_status: string;
  ticket_title: string;
  ticket_description: string;
  ticket_priority: string;
  apartment_unit?: string | null;
  technician_name?: string | null;
  rating?: number | null;
  rating_comment?: string | null;
}

export interface Amenity {
  id: string;
  building_id: string;
  name: string;
  description?: string | null;
  capacity: number;
  available_slots: string[];
  requires_approval: boolean;
  is_active: boolean;
}

export interface AmenitySlot {
  time_slot: string;
  is_available: boolean;
  booking_id?: string | null;
  status?: string | null;
  is_own_booking: boolean;
}

export interface AmenitySlotsResponse {
  amenity_id: string;
  amenity_name: string;
  capacity: number;
  requires_approval: boolean;
  booking_date: string;
  slots: AmenitySlot[];
}

export interface AmenityBooking {
  id: string;
  amenity_id: string;
  amenity_name: string;
  apartment_id: string;
  apartment_unit?: string | null;
  user_id: string;
  user_name?: string | null;
  booking_date: string;
  time_slot: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | string;
  notes?: string | null;
  created_at: string;
}

export type AnnouncementCategory = 'maintenance' | 'event' | 'safety' | 'general';
export type AnnouncementPriority = 'urgent' | 'standard';

export interface Announcement {
  id: string;
  building_id: string;
  title: string;
  content: string;
  category: AnnouncementCategory | string;
  priority: AnnouncementPriority | string;
  published_by?: string | null;
  publisher_name?: string | null;
  published_at: string;
  expires_at?: string | null;
  pin_to_top: boolean;
  image_url?: string | null;
  is_active: boolean;
  is_read?: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface AnnouncementFeedResponse {
  items: Announcement[];
  total_unread: number;
  total_count: number;
}

// --- Bulk Operations & Report Exports (Priority 5) ---
export interface BulkJob {
  id: string;
  job_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  processed_items: number;
  failed_items: number;
  created_by?: string | null;
  created_at: string;
  finished_at?: string | null;
  error_summary?: any[];
}

export interface ReportExport {
  id: string;
  report_type: 'collection' | 'overdue' | 'tickets' | 'reconciliation';
  params: Record<string, any>;
  format: 'xlsx' | 'pdf' | 'csv';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url: string | null;
  file_size_bytes: number;
  requested_at: string;
  expires_at: string | null;
}

export interface BillingRate {
  id: string;
  building_id: string;
  water_price_per_m3: number;
  management_fee_per_sqm: number;
  parking_fee_per_slot: number;
  effective_date: string;
  created_at: string;
}

