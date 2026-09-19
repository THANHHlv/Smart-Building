import type {
  Alert,
  AiQueryResponse,
  AnomalyResponse,
  Building,
  DashboardOverview,
  DemoAccount,
  Device,
  EnergyDashboard,
  InvoiceDetail,
  InvoiceListItem,
  MaintenanceTicket,
  PayInvoiceResponse,
  PaymentMethod,
  ResidentDashboardResponse,
  ServiceCatalogItem,
  MyServiceItem,
  InvoiceSummary,
  InvoiceBreakdownResponse,
  ManualConfirmRequest,
  ReminderSettingsRequest,
  SimulationTickResponse,
  TokenResponse,
  UserAdminItem,
  UserProfile,
  WaterDashboard,
  NotificationListResponse,
  NotificationPreferenceItem,
  NotificationPreferencesResponse,
  ResidentNotification,
  Ticket,
  TicketDetail,
  TicketAttachment,
  TicketComment,
  Technician,
  SlaReport,
  AdminDashboardOverview,
  CollectionRateResponse,
  OverdueApartmentItem,
  DeviceHealthResponse,
  UserWithRolesResponse,
  RoleItem,
  ServiceRequest,
  Amenity,
  AmenityBooking,
  AmenitySlotsResponse,
  Announcement,
  AnnouncementFeedResponse,
  BulkJob,
  BillingRate,
  ReportExport,
} from '../types';



const API_BASE = 'http://localhost:8000/api/v1';
const TOKEN_KEY = 'sb_access_token';

let currentAuthToken: string | null = null;

/**
 * Set JWT token in memory and persist to localStorage.
 */
export const setAuthToken = (token: string | null) => {
  currentAuthToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

/**
 * Get current token from memory.
 */
export const getAuthToken = () => currentAuthToken;

/**
 * Restore token from localStorage on app startup.
 */
export const restoreAuthToken = (): string | null => {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) {
    currentAuthToken = stored;
  }
  return stored;
};

/**
 * Clear token (logout).
 */
export const clearAuthToken = () => {
  currentAuthToken = null;
  localStorage.removeItem(TOKEN_KEY);
};

// Global callback for 401 handling (token expired)
let onAuthError: (() => void) | null = null;
export const setOnAuthError = (cb: () => void) => {
  onAuthError = cb;
};

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  // Only default to application/json if body is not FormData
  if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (currentAuthToken) {
    headers.Authorization = `Bearer ${currentAuthToken}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // Handle 401 — token expired or invalid
    if (res.status === 401 && onAuthError) {
      clearAuthToken();
      onAuthError();
    }

    const errData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errData.detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  // --- Authentication & Registration ---
  login: (email: string, password: string): Promise<TokenResponse> =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, fullName: string): Promise<TokenResponse> =>
    request<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    }),

  getMe: (): Promise<UserProfile> => request<UserProfile>('/auth/me'),

  getDemoAccounts: (): Promise<DemoAccount[]> =>
    request<DemoAccount[]>('/auth/demo-accounts'),

  // --- Resident Scoped Dashboard ---
  getResidentDashboard: (apartmentId?: string): Promise<ResidentDashboardResponse> => {
    const query = apartmentId ? `?apartment_id=${apartmentId}` : '';
    return request<ResidentDashboardResponse>(`/resident/dashboard${query}`);
  },

  // --- Overview & Admin Analytics ---
  getOverview: () => request<DashboardOverview>('/dashboard/overview'),
  getEnergy: () => request<EnergyDashboard>('/dashboard/energy'),
  getWater: () => request<WaterDashboard>('/dashboard/water'),

  // --- Buildings & Devices ---
  getBuildings: () => request<{ items: Building[]; total: number }>('/buildings'),
  getDevices: (limit = 100) => request<{ items: Device[]; total: number }>(`/devices?limit=${limit}`),

  // --- Sensor Readings ---
  getReadings: (metric?: string, limit = 50) => {
    const params = new URLSearchParams();
    if (metric) params.append('metric', metric);
    params.append('page_size', String(limit));
    return request<{ items: any[]; total: number }>(`/readings?${params.toString()}`);
  },

  // --- Alerts ---
  getAlerts: (limit = 50) => request<Alert[]>(`/alerts?limit=${limit}`),
  acknowledgeAlert: (alertId: string) =>
    request<Alert>(`/alerts/${alertId}/acknowledge`, { method: 'POST' }),
  resolveAlert: (alertId: string) =>
    request<Alert>(`/alerts/${alertId}/resolve`, { method: 'POST' }),

  // --- Simulator (Admin Only) ---
  triggerTick: () =>
    request<SimulationTickResponse>('/simulation/tick', { method: 'POST' }),
  injectAnomaly: (anomalyType: 'power_spike' | 'water_leak' | 'overheat') =>
    request<AnomalyResponse>(`/simulation/anomaly?anomaly_type=${anomalyType}`, {
      method: 'POST',
    }),

  // --- User Management & Onboarding (Admin Only) ---
  getUsers: (role?: string, assigned?: boolean, search?: string): Promise<UserAdminItem[]> => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (assigned !== undefined) params.append('assigned', String(assigned));
    if (search) params.append('search', search);
    const q = params.toString() ? `?${params.toString()}` : '';
    return request<UserAdminItem[]>(`/users${q}`);
  },

  assignApartment: (userId: string, apartmentId: string): Promise<UserAdminItem> =>
    request<UserAdminItem>(`/users/${userId}/assign-apartment`, {
      method: 'PUT',
      body: JSON.stringify({ apartment_id: apartmentId }),
    }),

  unassignApartment: (userId: string): Promise<UserAdminItem> =>
    request<UserAdminItem>(`/users/${userId}/unassign-apartment`, {
      method: 'PUT',
    }),

  toggleUserStatus: (userId: string, isActive: boolean): Promise<{ message: string; id: string }> =>
    request<{ message: string; id: string }>(`/users/${userId}/toggle-status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    }),

  getApartments: (page = 1, pageSize = 100): Promise<{ items: any[]; total: number }> =>
    request<{ items: any[]; total: number }>(`/apartments?page=${page}&page_size=${pageSize}`),

  // --- Smart Device Control ---
  controlDevice: (deviceId: string, action: 'turn_on' | 'turn_off' | 'toggle'): Promise<Device> =>
    request<Device>(`/devices/${deviceId}/control`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  // --- Maintenance & Support Tickets ---
  getMaintenanceTickets: (status?: string, category?: string): Promise<MaintenanceTicket[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (category) params.append('category', category);
    const q = params.toString() ? `?${params.toString()}` : '';
    return request<MaintenanceTicket[]>(`/maintenance${q}`);
  },

  createMaintenanceTicket: (data: {
    title: string;
    description: string;
    category?: string;
    urgency?: string;
  }): Promise<MaintenanceTicket> =>
    request<MaintenanceTicket>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMaintenanceTicket: (
    ticketId: string,
    data: { status?: string; technician_notes?: string }
  ): Promise<MaintenanceTicket> =>
    request<MaintenanceTicket>(`/maintenance/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // --- Building AI Assistant ---
  chatWithAi: (message: string): Promise<AiQueryResponse> =>
    request<AiQueryResponse>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  // --- Payment & Billing ---
  getInvoices: (status?: string, page = 1, pageSize = 20): Promise<{ items: InvoiceListItem[]; total: number }> => {
    const params = new URLSearchParams();
    if (status) params.append('status_filter', status);
    params.append('page', String(page));
    params.append('page_size', String(pageSize));
    return request<{ items: InvoiceListItem[]; total: number }>(`/invoices?${params.toString()}`);
  },

  getInvoiceDetail: (id: string): Promise<InvoiceDetail> =>
    request<InvoiceDetail>(`/invoices/${id}`),

  payInvoice: (id: string, idempotencyKey: string, returnUrl?: string): Promise<PayInvoiceResponse> =>
    request<PayInvoiceResponse>(`/invoices/${id}/pay`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ return_url: returnUrl || window.location.href }),
    }),

  getPaymentMethods: (): Promise<PaymentMethod[]> =>
    request<PaymentMethod[]>('/payment-methods'),

  getServicesCatalog: (): Promise<ServiceCatalogItem[]> =>
    request<ServiceCatalogItem[]>('/services'),

  // --- My Services (Resident Portal) ---
  getMyServices: (): Promise<MyServiceItem[]> =>
    request<MyServiceItem[]>('/me/services'),

  getMyInvoiceSummary: (): Promise<InvoiceSummary> =>
    request<InvoiceSummary>('/me/invoices/summary'),

  getMyInvoiceBreakdown: (invoiceId: string): Promise<InvoiceBreakdownResponse> =>
    request<InvoiceBreakdownResponse>(`/me/invoices/${invoiceId}/breakdown`),

  confirmManualPayment: (invoiceId: string, payload: ManualConfirmRequest): Promise<{ message: string }> =>
    request<{ message: string }>(`/me/invoices/${invoiceId}/confirm-manual`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateReminderSettings: (payload: ReminderSettingsRequest): Promise<{ message: string; settings: ReminderSettingsRequest }> =>
    request<{ message: string; settings: ReminderSettingsRequest }>('/me/reminders/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // --- Notification Service ---
  getMyNotifications: (
    category?: string,
    status?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<NotificationListResponse> => {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (status && status !== 'all') params.append('status', status);
    params.append('page', String(page));
    params.append('page_size', String(pageSize));
    return request<NotificationListResponse>(`/me/notifications?${params.toString()}`);
  },

  markNotificationAsRead: (notificationId: string): Promise<ResidentNotification> =>
    request<ResidentNotification>(`/me/notifications/${notificationId}/read`, {
      method: 'POST',
    }),

  markAllNotificationsAsRead: (): Promise<{ message: string; read_count: number }> =>
    request<{ message: string; read_count: number }>('/me/notifications/read-all', {
      method: 'POST',
    }),

  getNotificationPreferences: (): Promise<NotificationPreferencesResponse> =>
    request<NotificationPreferencesResponse>('/me/notification-preferences'),

  updateNotificationPreferences: (
    preferences: NotificationPreferenceItem[]
  ): Promise<NotificationPreferencesResponse> =>
    request<NotificationPreferencesResponse>('/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    }),

  dispatchNotificationEvent: (payload: any): Promise<any> =>
    request<any>('/notifications/dispatch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // --- Ticket & Work Order Service ---
  getTickets: (params?: {
    status?: string;
    category?: string;
    priority?: string;
    source?: string;
    overdue_only?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ items: Ticket[]; total: number; page: number; page_size: number }> => {
    const q = new URLSearchParams();
    if (params?.status && params.status !== 'all') q.append('status', params.status);
    if (params?.category && params.category !== 'all') q.append('category', params.category);
    if (params?.priority && params.priority !== 'all') q.append('priority', params.priority);
    if (params?.source && params.source !== 'all') q.append('source', params.source);
    if (params?.overdue_only) q.append('overdue_only', 'true');
    if (params?.search) q.append('search', params.search);
    if (params?.page) q.append('page', String(params.page));
    if (params?.page_size) q.append('page_size', String(params.page_size));
    const qs = q.toString();
    return request<{ items: Ticket[]; total: number; page: number; page_size: number }>(
      `/tickets${qs ? `?${qs}` : ''}`
    );
  },

  getTicketDetail: (ticketId: string): Promise<TicketDetail> =>
    request<TicketDetail>(`/tickets/${ticketId}`),

  createTicket: (payload: {
    title: string;
    description: string;
    category: string;
    apartment_id?: string;
    device_id?: string;
    priority?: string;
  }): Promise<Ticket> =>
    request<Ticket>('/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  assignTicket: (
    ticketId: string,
    payload: { technician_id?: string; note?: string }
  ): Promise<TicketDetail> =>
    request<TicketDetail>(`/tickets/${ticketId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateTicketStatus: (
    ticketId: string,
    payload: { status: string; note?: string }
  ): Promise<TicketDetail> =>
    request<TicketDetail>(`/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  addTicketComment: (
    ticketId: string,
    payload: { comment: string; is_internal?: boolean }
  ): Promise<TicketComment> =>
    request<TicketComment>(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  uploadTicketAttachment: (ticketId: string, file: File): Promise<TicketAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<TicketAttachment>(`/tickets/${ticketId}/attachments`, {
      method: 'POST',
      body: formData,
    });
  },

  rateTicket: (
    ticketId: string,
    payload: { rating: number; feedback?: string }
  ): Promise<TicketDetail> =>
    request<TicketDetail>(`/tickets/${ticketId}/rate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reopenTicket: (
    ticketId: string,
    payload: { reason: string }
  ): Promise<TicketDetail> =>
    request<TicketDetail>(`/tickets/${ticketId}/reopen`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getTechnicians: (specialty?: string): Promise<Technician[]> => {
    const q = specialty ? `?specialty=${encodeURIComponent(specialty)}` : '';
    return request<Technician[]>(`/tickets/technicians${q}`);
  },

  getTicketSlaReport: (month?: string): Promise<SlaReport> => {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    return request<SlaReport>(`/admin/tickets/sla-report${q}`);
  },

  // --- RBAC & Admin Operations Dashboard APIs ---

  getAdminOverview: (buildingId?: string): Promise<AdminDashboardOverview> => {
    const q = buildingId ? `?building_id=${encodeURIComponent(buildingId)}` : '';
    return request<AdminDashboardOverview>(`/admin/dashboard/overview${q}`);
  },

  getCollectionRate: (months?: number, buildingId?: string): Promise<CollectionRateResponse> => {
    const params = new URLSearchParams();
    if (months) params.append('months', months.toString());
    if (buildingId) params.append('building_id', buildingId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<CollectionRateResponse>(`/admin/dashboard/collection-rate${qs}`);
  },

  getOverdueApartments: (
    buildingId?: string,
    minDaysOverdue?: number
  ): Promise<OverdueApartmentItem[]> => {
    const params = new URLSearchParams();
    if (buildingId) params.append('building_id', buildingId);
    if (minDaysOverdue !== undefined) params.append('min_days_overdue', minDaysOverdue.toString());
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<OverdueApartmentItem[]>(`/admin/dashboard/overdue-apartments${qs}`);
  },

  getDeviceHealth: (buildingId?: string): Promise<DeviceHealthResponse> => {
    const q = buildingId ? `?building_id=${encodeURIComponent(buildingId)}` : '';
    return request<DeviceHealthResponse>(`/admin/dashboard/device-health${q}`);
  },

  getAdminUsers: (search?: string): Promise<UserWithRolesResponse[]> => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<UserWithRolesResponse[]>(`/admin/users${q}`);
  },

  getAdminRoles: (): Promise<RoleItem[]> => {
    return request<RoleItem[]>('/admin/roles');
  },

  assignUserRole: (
    userId: string,
    payload: { role_id: string; building_id?: string }
  ): Promise<{ message: string; assignment_id: string }> => {
    return request<{ message: string; assignment_id: string }>(`/admin/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  revokeUserRole: (userId: string, roleId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/users/${userId}/roles/${roleId}`, {
      method: 'DELETE',
    });
  },

  // ---------------------------------------------------------------------------
  // Priority 4: Self-Service Requests, Amenities & Community Bulletin Board
  // ---------------------------------------------------------------------------
  getMyServiceRequests: (): Promise<ServiceRequest[]> => {
    return request<ServiceRequest[]>('/me/service-requests');
  },

  createServiceRequest: (payload: {
    request_type: string;
    title: string;
    description: string;
    apartment_id?: string;
    scheduled_at?: string;
    scheduled_slot?: string;
    notes?: Record<string, any>;
  }): Promise<ServiceRequest> => {
    return request<ServiceRequest>('/service-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAmenities: (buildingId?: string): Promise<Amenity[]> => {
    const q = buildingId ? `?building_id=${encodeURIComponent(buildingId)}` : '';
    return request<Amenity[]>(`/amenities${q}`);
  },

  getAmenityAvailableSlots: (amenityId: string, date: string): Promise<AmenitySlotsResponse> => {
    return request<AmenitySlotsResponse>(`/amenities/${amenityId}/available-slots?date=${encodeURIComponent(date)}`);
  },

  createAmenityBooking: (
    amenityId: string,
    payload: {
      booking_date: string;
      time_slot: string;
      notes?: string;
      apartment_id?: string;
    }
  ): Promise<AmenityBooking> => {
    return request<AmenityBooking>(`/amenities/${amenityId}/bookings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  cancelAmenityBooking: (bookingId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/amenities/bookings/${bookingId}`, {
      method: 'DELETE',
    });
  },

  getMyAmenityBookings: (): Promise<AmenityBooking[]> => {
    return request<AmenityBooking[]>('/me/amenity-bookings');
  },

  getAnnouncements: (category?: string, buildingId?: string): Promise<AnnouncementFeedResponse> => {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (buildingId) params.append('building_id', buildingId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<AnnouncementFeedResponse>(`/announcements${qs}`);
  },

  markAnnouncementAsRead: (announcementId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/announcements/${announcementId}/read`, {
      method: 'POST',
    });
  },

  createAdminAnnouncement: (payload: {
    building_id?: string;
    title: string;
    content: string;
    category?: string;
    priority?: string;
    expires_at?: string;
    pin_to_top?: boolean;
    image_url?: string;
  }): Promise<Announcement> => {
    return request<Announcement>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAdminAnnouncement: (
    announcementId: string,
    payload: Partial<{
      title: string;
      content: string;
      category: string;
      priority: string;
      expires_at: string | null;
      pin_to_top: boolean;
      image_url: string | null;
      is_active: boolean;
    }>
  ): Promise<Announcement> => {
    return request<Announcement>(`/admin/announcements/${announcementId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteAdminAnnouncement: (announcementId: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/announcements/${announcementId}`, {
      method: 'DELETE',
    });
  },

  // --- Bulk Operations & Reports (Priority 5) ---
  generateBulkInvoices: (payload: { building_id?: string; target_date?: string }): Promise<BulkJob> => {
    return request<BulkJob>('/admin/bulk/invoices/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  sendBulkReminders: (payload: { building_id?: string; min_overdue_days?: number; apartment_ids?: string[] }): Promise<BulkJob> => {
    return request<BulkJob>('/admin/bulk/reminders/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  approveBulkManualConfirmations: (payload: { confirmation_ids: string[]; note?: string }): Promise<BulkJob> => {
    return request<BulkJob>('/admin/bulk/manual-confirmations/approve', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateBillingRates: (payload: {
    building_id: string;
    water_price_per_m3: number;
    management_fee_per_sqm: number;
    parking_fee_per_slot: number;
    effective_date: string;
  }): Promise<BillingRate> => {
    return request<BillingRate>('/admin/billing-rates', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getBulkJobStatus: (jobId: string): Promise<BulkJob> => {
    return request<BulkJob>(`/admin/bulk-jobs/${jobId}`);
  },

  exportReport: (
    reportType: 'collection' | 'overdue' | 'tickets' | 'reconciliation',
    params: Record<string, any>
  ): Promise<ReportExport> => {
    return request<ReportExport>(`/admin/reports/${reportType}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};


