/**
 * API Service Layer for SACCO Shareholders Module
 * 
 * This file contains example API service functions that should be implemented
 * to connect the frontend to the backend API.
 * 
 * Location: src/services/saccoAPI.ts
 */

type QueryFilters = Record<string, string | number | boolean | undefined>;
type JsonObject = Record<string, unknown>;

type ApiOptions = {
  params?: QueryFilters;
  headers?: Record<string, string>;
  responseType?: 'blob';
};

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const toQueryString = (params?: QueryFilters) => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const request = async (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  options: ApiOptions = {}
) => {
  const url = `${API_BASE_URL}${path}${toQueryString(options.params)}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `API request failed with status ${response.status}`);
  }

  if (options.responseType === 'blob') {
    const data = await response.blob();
    return { data };
  }

  const data = await response.json().catch(() => ({}));
  return { data };
};

const api = {
  get: (path: string, options?: ApiOptions) => request('GET', path, undefined, options),
  post: (path: string, body?: unknown, options?: ApiOptions) => request('POST', path, body, options),
  put: (path: string, body?: unknown, options?: ApiOptions) => request('PUT', path, body, options),
  delete: (path: string, options?: ApiOptions) => request('DELETE', path, undefined, options),
};

// ============================================================
// SHAREHOLDER ENDPOINTS
// ============================================================

export interface Shareholder {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: 'Staff' | 'Supplier' | 'Member' | 'Director' | 'Management';
  sharesOwned: number;
  shareValue: number;
  joinDate: string;
  status: 'Active' | 'Inactive' | 'Pending';
  certificateNo: string;
  beneficiary: string;
}

export const shareholderAPI = {
  /**
   * Get all shareholders with optional filters
   */
  getAll: async (filters?: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/shareholders', { params: filters });
    return response.data;
  },

  /**
   * Get a specific shareholder by ID
   */
  getById: async (id: string) => {
    const response = await api.get(`/shareholders/${id}`);
    return response.data;
  },

  /**
   * Create a new shareholder
   */
  create: async (shareholder: Omit<Shareholder, 'id'>) => {
    const response = await api.post('/shareholders', shareholder);
    return response.data;
  },

  /**
   * Update an existing shareholder
   */
  update: async (id: string, updates: Partial<Shareholder>) => {
    const response = await api.put(`/shareholders/${id}`, updates);
    return response.data;
  },

  /**
   * Delete a shareholder
   */
  delete: async (id: string) => {
    const response = await api.delete(`/shareholders/${id}`);
    return response.data;
  },

  /**
   * Get shareholder statistics
   */
  getStats: async () => {
    const response = await api.get('/shareholders/stats');
    return response.data;
  },

  /**
   * Export shareholders as CSV
   */
  exportCSV: async (filters?: QueryFilters) => {
    const response = await api.get('/shareholders/export/csv', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  },

  /**
   * Import shareholders from CSV
   */
  importCSV: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/shareholders/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

// ============================================================
// SHARE TRANSACTION ENDPOINTS
// ============================================================

export interface ShareTransaction {
  id: string;
  date: string;
  shareholderId: string;
  shareholderName: string;
  transactionType: 'Purchase' | 'Sale' | 'Transfer' | 'Dividend' | 'Redemption';
  quantity: number;
  pricePerShare: number;
  amount: number;
  description: string;
  status: 'Completed' | 'Pending';
}

export const shareAPI = {
  /**
   * Get all share transactions
   */
  getTransactions: async (filters?: {
    fromDate?: string;
    toDate?: string;
    type?: string;
    shareholderId?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/shares/transactions', { params: filters });
    return response.data;
  },

  /**
   * Get transaction by ID
   */
  getTransaction: async (id: string) => {
    const response = await api.get(`/shares/transactions/${id}`);
    return response.data;
  },

  /**
   * Record a new share transaction
   */
  createTransaction: async (transaction: Omit<ShareTransaction, 'id'>) => {
    const response = await api.post('/shares/transactions', transaction);
    return response.data;
  },

  /**
   * Update a share transaction
   */
  updateTransaction: async (id: string, updates: Partial<ShareTransaction>) => {
    const response = await api.put(`/shares/transactions/${id}`, updates);
    return response.data;
  },

  /**
   * Get share distribution summary
   */
  getDistributionSummary: async () => {
    const response = await api.get('/shares/distribution-summary');
    return response.data;
  },

  /**
   * Get shareholder's holdings
   */
  getHoldings: async (shareholderId: string) => {
    const response = await api.get(`/shares/holdings/${shareholderId}`);
    return response.data;
  },

  /**
   * Get share price history
   */
  getPriceHistory: async () => {
    const response = await api.get('/shares/price-history');
    return response.data;
  }
};

// ============================================================
// DIVIDEND ENDPOINTS
// ============================================================

export interface Dividend {
  id: string;
  year: number;
  period: string;
  declaredDate: string;
  recordDate: string;
  paymentDate: string;
  totalAmount: number;
  sharesOutstanding: number;
  dividendPerShare: number;
  status: 'Proposed' | 'Approved' | 'Paid';
  approvedBy: string;
}

export interface DividendPayment {
  id: string;
  shareholderId: string;
  shareholderName: string;
  shares: number;
  dividendId: string;
  amount: number;
  paymentDate: string;
  status: 'Paid' | 'Processing' | 'Pending';
}

export const dividendAPI = {
  /**
   * Get all dividend declarations
   */
  getDeclarations: async (filters?: {
    year?: number;
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/dividends/declarations', { params: filters });
    return response.data;
  },

  /**
   * Get specific dividend declaration
   */
  getDeclaration: async (id: string) => {
    const response = await api.get(`/dividends/declarations/${id}`);
    return response.data;
  },

  /**
   * Declare a new dividend
   */
  declare: async (dividend: Omit<Dividend, 'id'>) => {
    const response = await api.post('/dividends/declarations', dividend);
    return response.data;
  },

  /**
   * Approve a dividend declaration
   */
  approve: async (id: string) => {
    const response = await api.put(`/dividends/declarations/${id}/approve`);
    return response.data;
  },

  /**
   * Get dividend payment status
   */
  getPayments: async (dividendId: string) => {
    const response = await api.get(`/dividends/${dividendId}/payments`);
    return response.data;
  },

  /**
   * Record a dividend payment
   */
  recordPayment: async (payment: DividendPayment) => {
    const response = await api.post('/dividends/payments', payment);
    return response.data;
  },

  /**
   * Get dividend history for a shareholder
   */
  getHistory: async (shareholderId: string) => {
    const response = await api.get(`/dividends/history/${shareholderId}`);
    return response.data;
  },

  /**
   * Calculate dividend amount
   */
  calculate: async (declaration: Dividend) => {
    const response = await api.post('/dividends/calculate', declaration);
    return response.data;
  }
};

// ============================================================
// RESERVE FUND ENDPOINTS
// ============================================================

export interface ReserveFund {
  balance: number;
  statutory: number;
  operational: number;
  risk: number;
  growth: number;
  emergency: number;
  lastUpdated: string;
}

export const reserveAPI = {
  /**
   * Get current reserve fund status
   */
  getStatus: async () => {
    const response = await api.get('/reserves/status');
    return response.data;
  },

  /**
   * Get reserve fund history
   */
  getHistory: async (filters?: {
    fromDate?: string;
    toDate?: string;
  }) => {
    const response = await api.get('/reserves/history', { params: filters });
    return response.data;
  },

  /**
   * Record a reserve allocation
   */
  allocate: async (allocation: {
    category: string;
    amount: number;
    description: string;
  }) => {
    const response = await api.post('/reserves/allocate', allocation);
    return response.data;
  },

  /**
   * Update reserve allocation
   */
  updateAllocation: async (id: string, updates: JsonObject) => {
    const response = await api.put(`/reserves/${id}`, updates);
    return response.data;
  },

  /**
   * Get reserve statistics
   */
  getStats: async () => {
    const response = await api.get('/reserves/stats');
    return response.data;
  }
};

// ============================================================
// DOCUMENTS ENDPOINTS
// ============================================================

export interface Document {
  id: string;
  title: string;
  description: string;
  category: string;
  version: string;
  lastUpdated: string;
  size: string;
  status: 'Active' | 'Review' | 'Archived';
}

export const documentAPI = {
  /**
   * Get all documents with optional filters
   */
  getAll: async (filters?: {
    category?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/documents', { params: filters });
    return response.data;
  },

  /**
   * Get specific document
   */
  get: async (id: string) => {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },

  /**
   * Upload a document
   */
  upload: async (file: File, metadata: Partial<Document>) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, value as string);
    });
    const response = await api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  /**
   * Update document metadata
   */
  update: async (id: string, updates: Partial<Document>) => {
    const response = await api.put(`/documents/${id}`, updates);
    return response.data;
  },

  /**
   * Delete a document
   */
  delete: async (id: string) => {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  },

  /**
   * Download a document
   */
  download: async (id: string) => {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

// ============================================================
// AUDIT LOG ENDPOINTS
// ============================================================

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity: string;
  details: string;
  status: 'Completed' | 'Blocked' | 'Pending';
  ipAddress: string;
}

export const auditAPI = {
  /**
   * Get audit logs with filters
   */
  getLogs: async (filters?: {
    action?: string;
    status?: string;
    user?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get('/audit/logs', { params: filters });
    return response.data;
  },

  /**
   * Get specific audit log
   */
  getLog: async (id: string) => {
    const response = await api.get(`/audit/logs/${id}`);
    return response.data;
  },

  /**
   * Get audit statistics
   */
  getStats: async () => {
    const response = await api.get('/audit/stats');
    return response.data;
  },

  /**
   * Export audit logs
   */
  export: async (format: 'csv' | 'pdf', filters?: QueryFilters) => {
    const response = await api.get(`/audit/export/${format}`, {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }
};

// ============================================================
// REPORTS ENDPOINTS
// ============================================================

export const reportAPI = {
  /**
   * Generate a report
   */
  generate: async (reportType: string, filters?: JsonObject) => {
    const response = await api.post(`/reports/${reportType}`, filters);
    return response.data;
  },

  /**
   * Get pre-built reports list
   */
  getReports: async () => {
    const response = await api.get('/reports');
    return response.data;
  },

  /**
   * Download report in format
   */
  download: async (reportId: string, format: 'pdf' | 'excel' | 'csv') => {
    const response = await api.get(`/reports/${reportId}/download`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }
};

// ============================================================
// EXPORT DEFAULT
// ============================================================

export default {
  shareholder: shareholderAPI,
  share: shareAPI,
  dividend: dividendAPI,
  reserve: reserveAPI,
  document: documentAPI,
  audit: auditAPI,
  report: reportAPI
};
