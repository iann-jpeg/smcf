import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNotification } from './use-notification';
import { authService } from '@/lib/authService';
import API_BASE from '@/lib/api';

/**
 * Global Socket Notification Hook
 * 
 * This hook sets up centralized socket listeners for all notification events.
 * It should be used once at the app level (in App.tsx or a layout component).
 * 
 * This ensures ALL members receive notifications regardless of which page they're on.
 */
export function useSocketNotifications() {
  const socketRef = useRef<Socket | null>(null);
  const { 
    notifyPayment, 
    notifySuccess, 
    notifyWarning, 
    notifyAnnouncement,
    notifyLoan,
    notifySavings
  } = useNotification();
  const currentUser = authService.getUser();

  useEffect(() => {
    if (!currentUser) return;

    // Initialize socket connection
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Store socket globally for other components to use
    (window as any).socket = socket;

    socket.on('connect', () => {
      console.log('🔌 Socket connected for notifications:', socket.id);
      
      // Register user as online
      socket.emit('user:online', {
        memberId: currentUser._id || currentUser.id,
        memberName: currentUser.name || currentUser.username,
        isAdmin: currentUser.role === 'admin',
      });
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    // ==================== ANNOUNCEMENT EVENTS ====================
    socket.on('announcementCreated', (announcement: any) => {
      console.log('📢 Announcement received:', announcement);
      notifyAnnouncement(
        '📢 New Announcement',
        announcement.title || announcement.message || 'Check the announcements section',
        { announcement }
      );
    });

    socket.on('announcement:new', (announcement: any) => {
      console.log('📢 Announcement received:', announcement);
      notifyAnnouncement(
        '📢 New Announcement',
        announcement.title || announcement.message || 'Check the announcements section',
        { announcement }
      );
    });

    // ==================== PAYMENT EVENTS ====================
    socket.on('payment:completed', (data: any) => {
      console.log('💰 Payment completed:', data);
      
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      const isRecipient = data.memberId === currentUserId;
      const isPayer = data.payerId === currentUserId;
      
      if (data.type === 'wallet_deposit' && isRecipient) {
        notifySavings(
          '💰 Wallet Deposit Received',
          `KES ${data.amount?.toLocaleString() || 'N/A'} has been deposited to your wallet`,
          data
        );
      } else if (data.type === 'cycle_payment') {
        if (isPayer && data.isQRPayment) {
          notifyPayment(
            '✅ Payment Sent',
            `Your payment of KES ${data.amount?.toLocaleString() || 'N/A'} was successful`,
            data
          );
        } else if (isRecipient) {
          notifyPayment(
            '💰 Payment Received',
            `Payment of KES ${data.amount?.toLocaleString() || 'N/A'} confirmed`,
            data
          );
        } else {
          // Notify all members about cycle payment (important for cycle progress)
          // Use a less intrusive notification for non-involved members
          console.log('Cycle payment by another member - data refreshed');
        }
      } else if (data.type === 'loan_repayment' && isRecipient) {
        notifyLoan(
          '✅ Loan Payment Received',
          `Your loan payment of KES ${data.amount?.toLocaleString() || 'N/A'} was successful`,
          data
        );
      }
    });

    socket.on('payment:new', (data: any) => {
      console.log('💳 New payment:', data);
      // This is for admin awareness mostly
    });

    // ==================== SAVINGS EVENTS ====================
    socket.on('savingDeposit', (data: any) => {
      console.log('💰 Saving deposit:', data);
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      
      if (data.memberId === currentUserId) {
        notifySavings(
          '💰 Deposit Successful',
          `KES ${data.amount?.toLocaleString() || 'N/A'} deposited. New balance: KES ${data.newBalance?.toLocaleString() || 'N/A'}`,
          data
        );
      }
    });

    socket.on('saving:new', (data: any) => {
      console.log('💾 New saving record:', data);
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      
      if (data.memberId === currentUserId) {
        // Already handled by savingDeposit event usually
      }
    });

    socket.on('interestApplied', (data: any) => {
      console.log('📈 Interest applied:', data);
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      
      if (data.memberId === currentUserId) {
        notifySavings(
          '📈 Interest Earned!',
          `KES ${data.interestAmount?.toLocaleString() || 'N/A'} interest has been added to your savings`,
          data
        );
      }
    });

    // ==================== LOAN EVENTS ====================
    socket.on('loanStatusUpdated', (data: any) => {
      console.log('📋 Loan status updated:', data);
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      
      if (data.memberId === currentUserId) {
        const statusEmojis: Record<string, string> = {
          approved: '✅',
          rejected: '❌',
          disbursed: '💸',
          repaid: '🎉',
        };
        
        const statusMessages: Record<string, string> = {
          approved: `Your loan of KES ${data.amount?.toLocaleString()} has been approved!`,
          rejected: data.rejectionReason 
            ? `Loan rejected: ${data.rejectionReason}` 
            : `Your loan request was not approved`,
          disbursed: `KES ${data.amount?.toLocaleString()} has been sent to your M-Pesa`,
          repaid: `Congratulations! Your loan has been fully repaid`,
        };

        const emoji = statusEmojis[data.status] || '📋';
        const message = statusMessages[data.status] || `Loan status: ${data.status}`;
        
        notifyLoan(
          `${emoji} Loan ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}`,
          message,
          data
        );
      }
    });

    socket.on('loanPayment', (data: any) => {
      console.log('💳 Loan payment:', data);
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      
      if (data.memberId === currentUserId) {
        const isFullyPaid = data.isFullyPaid || data.remaining <= 0;
        
        notifyLoan(
          isFullyPaid ? '🎉 Loan Fully Repaid!' : '✅ Loan Payment Received',
          isFullyPaid
            ? `Congratulations! Your loan of KES ${data.totalPaid?.toLocaleString()} has been fully repaid.`
            : `Payment of KES ${data.paymentAmount?.toLocaleString()} received. Remaining: KES ${data.remaining?.toLocaleString()}`,
          data
        );
      }
    });

    socket.on('loanLateFeeApplied', (data: any) => {
      console.log('⚠️ Late fee applied:', data);
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      
      if (data.memberId === currentUserId) {
        notifyWarning(
          '⚠️ Late Fee Applied',
          `A late fee of KES ${data.feeAmount?.toLocaleString() || 'N/A'} has been added to your loan`,
          data
        );
      }
    });

    // ==================== DISBURSEMENT EVENTS ====================
    socket.on('disbursementCompleted', (data: any) => {
      console.log('💸 Disbursement completed:', data);
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      
      if (data.memberId === currentUserId) {
        notifySuccess(
          '💸 Disbursement Received!',
          `KES ${data.amount?.toLocaleString() || 'N/A'} has been sent to your M-Pesa`,
          data
        );
      }
    });

    // ==================== CYCLE EVENTS ====================
    socket.on('cycle:updated', (data: any) => {
      console.log('🔄 Cycle updated:', data);
      // Don't notify - just log for data refresh
    });

    socket.on('cycleUpdated', (data: any) => {
      console.log('🔄 Cycle updated:', data);
      // Don't notify - just log for data refresh
    });

    socket.on('nextRecipientUpdated', (data: any) => {
      console.log('👤 Next recipient updated:', data);
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      
      if (data.nextRecipientId === currentUserId) {
        notifySuccess(
          '🎉 You\'re Next!',
          'You are the next recipient for the cycle disbursement!',
          data
        );
      }
    });

    // ==================== MEMBER EVENTS ====================
    socket.on('member:new', (data: any) => {
      console.log('👤 New member:', data);
      // Only notify admins
      if (currentUser.role === 'admin') {
        notifySuccess(
          '👤 New Member Joined',
          `${data.name || 'A new member'} has joined SMCF`,
          data
        );
      }
    });

    socket.on('memberUpdated', (data: any) => {
      console.log('👤 Member updated:', data);
      const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();
      
      if (data.memberId === currentUserId) {
        // Profile update notification if needed
      }
    });

    // Cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('announcementCreated');
      socket.off('announcement:new');
      socket.off('payment:completed');
      socket.off('payment:new');
      socket.off('savingDeposit');
      socket.off('saving:new');
      socket.off('interestApplied');
      socket.off('loanStatusUpdated');
      socket.off('loanPayment');
      socket.off('loanLateFeeApplied');
      socket.off('disbursementCompleted');
      socket.off('cycle:updated');
      socket.off('cycleUpdated');
      socket.off('nextRecipientUpdated');
      socket.off('member:new');
      socket.off('memberUpdated');
      socket.disconnect();
    };
  }, [currentUser, notifyPayment, notifySuccess, notifyWarning, notifyAnnouncement, notifyLoan, notifySavings]);

  return socketRef.current;
}
