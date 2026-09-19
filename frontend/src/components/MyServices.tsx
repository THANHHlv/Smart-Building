import React, { useEffect, useState } from 'react';
import {
  FileText,
  CreditCard,
  History,
  Settings,
  Bell,
  AlertCircle,
  Clock,
  Download,
  Info,
  Building,
  UploadCloud,
  X
} from 'lucide-react';
import type {
  MyServiceItem,
  InvoiceSummary,
  InvoiceBreakdownResponse,
  InvoiceListItem
} from '../types';
import { api } from '../services/api';

interface MyServicesProps {
  onClose?: () => void;
  asPage?: boolean;
}

export const MyServices: React.FC<MyServicesProps> = ({ onClose, asPage = false }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'history' | 'settings'>('overview');
  
  // Data States
  const [services, setServices] = useState<MyServiceItem[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  
  // Modal/Drawer States
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<InvoiceBreakdownResponse | null>(null);
  const [isManualConfirmOpen, setIsManualConfirmOpen] = useState(false);
  const [manualNote, setManualNote] = useState('');
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [svcRes, sumRes, invRes] = await Promise.all([
        api.getMyServices(),
        api.getMyInvoiceSummary(),
        api.getInvoices(undefined, 1, 10)
      ]);
      setServices(svcRes);
      setSummary(sumRes);
      setInvoices(invRes.items);
    } catch (error) {
      console.error('Error fetching My Services data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBreakdown = async (invoiceId: string) => {
    setSelectedInvoice(invoiceId);
    try {
      const data = await api.getMyInvoiceBreakdown(invoiceId);
      setBreakdown(data);
    } catch (error) {
      console.error('Failed to load breakdown', error);
    }
  };

  const submitManualPayment = async () => {
    if (!selectedInvoice) return;
    try {
      await api.confirmManualPayment(selectedInvoice, { method: 'bank_transfer', note: manualNote });
      setIsManualConfirmOpen(false);
      alert('Đã gửi yêu cầu xác nhận thanh toán.');
      fetchData(); // Refresh summary
    } catch (error: any) {
      alert(error.message || 'Lỗi khi gửi xác nhận.');
    }
  };

  const content = (
    <div className={`bg-[#1C1C1E] w-full ${asPage ? 'min-h-[calc(100vh-160px)]' : 'max-w-5xl h-[90vh]'} rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#2C2C2E]/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Dịch vụ của tôi</h2>
              <p className="text-sm text-gray-400">Quản lý dịch vụ và thanh toán căn hộ</p>
            </div>
          </div>
          {!asPage && onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar Tabs */}
          <div className="w-64 border-r border-white/10 bg-[#1C1C1E] p-4 flex flex-col space-y-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'overview' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span>Tổng quan tài chính</span>
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'services' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <Building className="w-5 h-5" />
              <span>Dịch vụ đang dùng</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'history' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <History className="w-5 h-5" />
              <span>Lịch sử thanh toán</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'settings' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span>Cài đặt nhắc nợ</span>
            </button>
          </div>

          {/* Main Panel */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#151517]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : (
              <>
                {/* --- OVERVIEW TAB --- */}
                {activeTab === 'overview' && summary && (
                  <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E] p-6 rounded-2xl border border-white/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                          <h3 className="text-gray-400 font-medium">Đã Quá Hạn</h3>
                          <div className="p-2 bg-red-500/10 text-red-400 rounded-full">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-white relative z-10">
                          {summary.total_overdue.toLocaleString()} ₫
                        </div>
                        <div className="text-sm text-red-400 mt-2 relative z-10">
                          {summary.overdue_count} hoá đơn cần thanh toán gấp
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E] p-6 rounded-2xl border border-white/10 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                          <h3 className="text-gray-400 font-medium">Sắp Đến Hạn</h3>
                          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-full">
                            <Clock className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-white relative z-10">
                          {summary.total_due_soon.toLocaleString()} ₫
                        </div>
                        <div className="text-sm text-amber-400 mt-2 relative z-10">
                          {summary.due_soon_count} hoá đơn trong 7 ngày tới
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E] p-6 rounded-2xl border border-white/10">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-gray-400 font-medium">Tổng Chưa Thanh Toán</h3>
                          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-full">
                            <CreditCard className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="text-3xl font-bold text-indigo-400">
                          {summary.total_unpaid.toLocaleString()} ₫
                        </div>
                        <div className="text-sm text-gray-400 mt-2">
                          Thanh toán ngay để tránh phí trễ hạn
                        </div>
                      </div>
                    </div>

                    {/* Pending Invoices List */}
                    <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-6">
                      <h3 className="text-lg font-medium text-white mb-4">Hoá Đơn Chưa Thanh Toán</h3>
                      <div className="space-y-4">
                        {invoices.filter(i => i.status === 'pending' || i.status === 'overdue').map((invoice) => (
                          <div key={invoice.id} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#2C2C2E]/30 hover:bg-[#2C2C2E]/60 transition-colors">
                            <div className="flex items-center space-x-4">
                              <div className={`p-3 rounded-full ${invoice.status === 'overdue' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-white font-medium">{invoice.invoice_number}</h4>
                                <p className="text-sm text-gray-400">Hạn: {invoice.due_date}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-6">
                              <div className="text-right">
                                <div className="text-lg font-semibold text-white">{invoice.total_amount.toLocaleString()} ₫</div>
                                <div className={`text-sm ${invoice.status === 'overdue' ? 'text-red-400' : 'text-amber-400'}`}>
                                  {invoice.status === 'overdue' ? 'Quá Hạn' : 'Đang chờ'}
                                </div>
                              </div>
                              <button 
                                onClick={() => handleViewBreakdown(invoice.id)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
                              >
                                Xem chi tiết
                              </button>
                            </div>
                          </div>
                        ))}
                        {invoices.filter(i => i.status === 'pending' || i.status === 'overdue').length === 0 && (
                          <div className="text-center py-8 text-gray-400">Không có hoá đơn nào cần thanh toán.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* --- SERVICES TAB --- */}
                {activeTab === 'services' && (
                  <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {services.map((svc) => (
                        <div key={svc.id} className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-colors">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="p-2.5 bg-[#2C2C2E] rounded-xl text-indigo-400">
                                {svc.service_type === 'electricity' ? <AlertCircle className="w-5 h-5" /> :
                                 svc.service_type === 'water' ? <Clock className="w-5 h-5" /> : 
                                 <Building className="w-5 h-5" />}
                              </div>
                              <div>
                                <h3 className="text-white font-medium">{svc.name}</h3>
                                <p className="text-sm text-gray-400">Loại: {svc.service_type}</p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                              Đang hoạt động
                            </span>
                          </div>
                          
                          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                            <div className="text-sm">
                              <span className="text-gray-400">Tự động trả: </span>
                              <span className={svc.auto_pay_enabled ? "text-indigo-400" : "text-gray-500"}>
                                {svc.auto_pay_enabled ? 'Bật' : 'Tắt'}
                              </span>
                            </div>
                            {svc.default_price && (
                              <div className="text-right">
                                <span className="text-white font-medium">{svc.default_price.toLocaleString()} ₫</span>
                                <span className="text-xs text-gray-500"> / {svc.unit}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* --- SETTINGS TAB --- */}
                {activeTab === 'settings' && (
                  <div className="max-w-2xl space-y-6 animate-in slide-in-from-right-4">
                    <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl p-6">
                      <h3 className="text-lg font-medium text-white mb-6">Kênh nhận thông báo cước</h3>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-[#2C2C2E]/50 rounded-xl">
                          <div className="flex items-center space-x-4">
                            <Bell className="w-6 h-6 text-indigo-400" />
                            <div>
                              <div className="text-white font-medium">Thông báo App</div>
                              <div className="text-sm text-gray-400">Nhận thông báo đẩy trên điện thoại</div>
                            </div>
                          </div>
                          <div className="w-11 h-6 bg-indigo-500 rounded-full relative cursor-pointer">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-[#2C2C2E]/50 rounded-xl">
                          <div className="flex items-center space-x-4">
                            <MessageSquare className="w-6 h-6 text-blue-400" />
                            <div>
                              <div className="text-white font-medium">Thông báo Zalo</div>
                              <div className="text-sm text-gray-400">Nhận tin nhắn Zalo OA từ toà nhà</div>
                            </div>
                          </div>
                          <div className="w-11 h-6 bg-[#3C3C3E] rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </>
            )}
          </div>
        </div>

      {/* Breakdown Modal */}
      {breakdown && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1C1C1E] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl p-6 relative overflow-hidden">
            <button onClick={() => setBreakdown(null)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-2">Chi tiết hoá đơn {breakdown.invoice_number}</h2>
            <div className="text-gray-400 mb-6 flex justify-between">
              <span>Kỳ cước: {breakdown.due_date}</span>
              <span className="text-indigo-400 font-medium">{breakdown.status.toUpperCase()}</span>
            </div>

            <div className="space-y-3 mb-6 max-h-[50vh] overflow-y-auto pr-2">
              {breakdown.items.map((item, idx) => (
                <div key={idx} className="bg-[#2C2C2E] p-4 rounded-xl border border-white/5">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-white font-medium">{item.description}</h4>
                    <span className="text-white font-semibold">{item.amount.toLocaleString()} ₫</span>
                  </div>
                  {item.formula && (
                    <div className="text-sm text-gray-400 bg-black/20 p-2 rounded flex items-start space-x-2">
                      <Info className="w-4 h-4 text-indigo-400 mt-0.5" />
                      <span className="font-mono text-xs">{item.formula}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center border-t border-white/10 pt-4 mb-6">
              <span className="text-lg text-gray-300">Tổng cộng</span>
              <span className="text-2xl font-bold text-white">{breakdown.total_amount.toLocaleString()} ₫</span>
            </div>

            <div className="flex space-x-3">
              {breakdown.status !== 'paid' && (
                <button 
                  onClick={() => setIsManualConfirmOpen(true)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-medium transition-colors"
                >
                  Báo cáo đã chuyển khoản
                </button>
              )}
              <button className="flex items-center justify-center space-x-2 px-6 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors">
                <Download className="w-4 h-4" />
                <span>Tải PDF</span>
              </button>
            </div>

            {/* Manual Confirm Form */}
            {isManualConfirmOpen && (
              <div className="mt-4 p-4 border border-indigo-500/30 bg-indigo-500/5 rounded-xl animate-in slide-in-from-top-2">
                <h4 className="text-white font-medium mb-3">Xác nhận thanh toán thủ công</h4>
                <p className="text-sm text-gray-400 mb-3">Vui lòng đính kèm ghi chú hoặc mã giao dịch để BQL đối soát nhanh hơn.</p>
                <textarea 
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="w-full bg-[#151517] border border-white/10 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-indigo-500 mb-3"
                  placeholder="Nhập mã giao dịch ngân hàng..."
                  rows={2}
                />
                <div className="flex justify-end space-x-3">
                  <button onClick={() => setIsManualConfirmOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Huỷ</button>
                  <button onClick={submitManualPayment} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center space-x-2">
                    <UploadCloud className="w-4 h-4" />
                    <span>Gửi xác nhận</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );

  if (asPage) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {content}
    </div>
  );
};

// Quick mock for MessageSquare icon
const MessageSquare = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
