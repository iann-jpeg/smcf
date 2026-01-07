import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useNotification } from './use-notification';
import { authService } from '@/lib/authService';
import API_BASE from '@/lib/api';

/**
 * Global Socket Notification Hook
 * 
 * This hook sets up centralized socket listeners for all notification events.
 * 
 * NOTIFICATION RULES:
 * - Regular members: Only receive notifications about their OWN account
 * - Admin: Receives ALL notifications from ALL members in the system
 * 
 * This ensures privacy while giving admin full visibility.
 */
export function useSocketNotifications() {
  const socketRef = useRef<Socket | null>(null);
  const { 
    notifyPayment, 
    notifySuccess, 
    notifyWarning, 
    notifyAnnouncement,
    notifyLoan,
    notifySavings,
    notifyInfo
  } = useNotification();
  const currentUser = authService.getUser();

  useEffect(() => {
    if (!currentUser) return;

    const isAdmin = currentUser.role === 'admin';
    const currentUserId = currentUser._id?.toString() || currentUser.id?.toString();

    // Helper to check if notification is for current user
    const isForCurrentUser = (memberId: string | undefined) => {
      if (!memberId) return false;
      return memberId === currentUserId;
    };

    // Helper to check if should show notification (admin sees all, members see own)
    const shouldShowNotification = (memberId: string | undefined) => {
      if (isAdmin) return true; // Admin sees ALL notifications
      return isForCurrentUser(memberId);
    };

    // For admin, always show notification regardless of memberId
    const adminShow = (cb: () => void) => {
      if (isAdmin) {
        cb();
        return true;
      }
      return false;
    };

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
        memberId: currentUserId,
        memberName: currentUser.name || currentUser.username,
        isAdmin,
      });
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    // ==================== ANNOUNCEMENT EVENTS ====================
    // Announcements go to ALL users (both admin and members)
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
      
      const memberId = data.memberId;
      const payerId = data.payerId;
      

      // For admin, always show; for members, check memberId/payerId
      if (adminShow(() => {
        if (data.type === 'wallet_deposit') {
          notifySavings(
            '💰 Wallet Deposit',
            `${memberName} deposited KES ${data.amount?.toLocaleString() || 'N/A'} to their wallet`,
            data
          );
        } else if (data.type === 'cycle_payment') {
          notifyPayment(
            '💰 Cycle Payment',
            `${memberName} made a cycle payment of KES ${data.amount?.toLocaleString() || 'N/A'}`,
            data
          );
        } else if (data.type === 'loan_repayment') {
          notifyLoan(
            '💳 Loan Repayment',
            `${memberName} made a loan payment of KES ${data.amount?.toLocaleString() || 'N/A'}`,
            data
          );
        }
      })) return;
      if (!shouldShowNotification(memberId) && !shouldShowNotification(payerId)) {
        return; // Skip - not relevant to this user
      }

      // Get member name for admin notifications
      const memberName = data.memberName || 'A member';
      
      if (data.type === 'wallet_deposit') {
        if (isAdmin) {
          notifySavings(
            '💰 Wallet Deposit',
            `${memberName} deposited KES ${data.amount?.toLocaleString() || 'N/A'} to their wallet`,
            data
          );
        } else if (isForCurrentUser(memberId)) {
          notifySavings(
            '💰 Wallet Deposit Received',
            `KES ${data.amount?.toLocaleString() || 'N/A'} has been deposited to your wallet`,
            data
          );
        }
      } else if (data.type === 'cycle_payment') {
        if (isAdmin) {
          notifyPayment(
            '💰 Cycle Payment',
            `${memberName} made a cycle payment of KES ${data.amount?.toLocaleString() || 'N/A'}`,
            data
          );
        } else {
          if (isForCurrentUser(payerId) && data.isQRPayment) {
            notifyPayment(
              '✅ Payment Sent',
              `Your payment of KES ${data.amount?.toLocaleString() || 'N/A'} was successful`,
              data
            );
          } else if (isForCurrentUser(memberId)) {
            notifyPayment(
              '💰 Payment Received',
              `Payment of KES ${data.amount?.toLocaleString() || 'N/A'} confirmed`,
              data
            );
          }
        }
      } else if (data.type === 'loan_repayment') {
        if (isAdmin) {
          notifyLoan(
            '💳 Loan Repayment',
            `${memberName} made a loan payment of KES ${data.amount?.toLocaleString() || 'N/A'}`,
            data
          );
        } else if (isForCurrentUser(memberId)) {
          notifyLoan(
            '✅ Loan Payment Received',
            `Your loan payment of KES ${data.amount?.toLocaleString() || 'N/A'} was successful`,
            data
          );
        }
      }
    });

    socket.on('payment:new', (data: any) => {
      console.log('💳 New payment:', data);
      // Admin gets notified of all new payments
      if (isAdmin) {
        const memberName = data.memberName || 'A member';
        notifyPayment(
          '💳 New Payment',
          `${memberName} initiated a payment of KES ${data.amount?.toLocaleString() || 'N/A'}`,
          data
        );
      }
    });

    // ==================== SAVINGS EVENTS ====================
    socket.on('savingDeposit', (data: any) => {
      console.log('💰 Saving deposit:', data);
      
      if (!shouldShowNotification(data.memberId)) return;
      
      const memberName = data.memberName || 'A member';
      
      if (isAdmin) {
        notifySavings(
          '💰 Savings Deposit',
          `${memberName} deposited KES ${data.amount?.toLocaleString() || 'N/A'}. Balance: KES ${data.newBalance?.toLocaleString() || 'N/A'}`,
          data
        );
      } else {
        notifySavings(
          '💰 Deposit Successful',
          `KES ${data.amount?.toLocaleString() || 'N/A'} deposited. New balance: KES ${data.newBalance?.toLocaleString() || 'N/A'}`,
          data
        );
      }
    });

    socket.on('saving:new', (data: any) => {
      console.log('💾 New saving record:', data);
      // Usually handled by savingDeposit event
    });

    socket.on('interestApplied', (data: any) => {
      console.log('📈 Interest applied:', data);
      
      if (!shouldShowNotification(data.memberId)) return;
      
      const memberName = data.memberName || 'A member';
      
      if (isAdmin) {
        notifySavings(
          '📈 Interest Applied',
          `${memberName} earned KES ${data.interestAmount?.toLocaleString() || 'N/A'} in interest`,
          data
        );
      } else {
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
      
      if (!shouldShowNotification(data.memberId)) return;
      
      const memberName = data.memberName || 'A member';
      const statusEmojis: Record<string, string> = {
        pending: '⏳',
        approved: '✅',
        rejected: '❌',
        disbursed: '💸',
        repaid: '🎉',
      };
      
      const emoji = statusEmojis[data.status] || '📋';
      const statusLabel = data.status.charAt(0).toUpperCase() + data.status.slice(1);
      
      if (adminShow(() => {
        const adminMessages: Record<string, string> = {
          pending: `${memberName} requested a loan of KES ${data.amount?.toLocaleString()}`,
          approved: `Loan of KES ${data.amount?.toLocaleString()} approved for ${memberName}`,
          rejected: `Loan of KES ${data.amount?.toLocaleString()} rejected for ${memberName}`,
          disbursed: `KES ${data.amount?.toLocaleString()} disbursed to ${memberName}`,
          repaid: `${memberName} has fully repaid their loan`,
        };
        notifyLoan(
          `${emoji} Loan ${statusLabel}`,
          adminMessages[data.status] || `${memberName}'s loan status: ${data.status}`,
          data
        );
      })) return;
      else {
        const memberMessages: Record<string, string> = {
          approved: `Your loan of KES ${data.amount?.toLocaleString()} has been approved!`,
          rejected: data.rejectionReason 
            ? `Loan rejected: ${data.rejectionReason}` 
            : `Your loan request was not approved`,
          disbursed: `KES ${data.amount?.toLocaleString()} has been sent to your M-Pesa`,
          repaid: `Congratulations! Your loan has been fully repaid`,
        };
        notifyLoan(
          `${emoji} Loan ${statusLabel}`,
          memberMessages[data.status] || `Loan status: ${data.status}`,
          data
        );
      }
    });

    socket.on('loanPayment', (data: any) => {
      console.log('💳 Loan payment:', data);
      
      if (!shouldShowNotification(data.memberId)) return;
      
      const memberName = data.memberName || 'A member';
      const isFullyPaid = data.isFullyPaid || data.remaining <= 0;
      
      if (adminShow(() => {
        notifyLoan(
          isFullyPaid ? '🎉 Loan Fully Repaid' : '💳 Loan Payment',
          isFullyPaid
            ? `${memberName} has fully repaid their loan of KES ${data.totalPaid?.toLocaleString()}`
            : `${memberName} paid KES ${data.paymentAmount?.toLocaleString()}. Remaining: KES ${data.remaining?.toLocaleString()}`,
          data
        );
      })) return;
      else {
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
      
      if (!shouldShowNotification(data.memberId)) return;
      
      const memberName = data.memberName || 'A member';
      
      if (adminShow(() => {
        notifyWarning(
          '⚠️ Late Fee Applied',
          `Late fee of KES ${data.feeAmount?.toLocaleString() || 'N/A'} applied to ${memberName}'s loan`,
          data
        );
      })) return;
      else {
        notifyWarning(
          '⚠️ Late Fee Applied',
          `A late fee of KES ${data.feeAmount?.toLocaleString() || 'N/A'} has been added to your loan`,
          data
        );
      }
    });

    // ==================== NEW LOAN REQUEST (Admin only) ====================
    socket.on('loanRequested', (data: any) => {
      console.log('📝 New loan request:', data);
      
      if (isAdmin) {
        const memberName = data.memberName || 'A member';
        notifyLoan(
          '📝 New Loan Request',
          `${memberName} requested a loan of KES ${data.amount?.toLocaleString() || 'N/A'}`,
          data
        );
      }
    });

    // ==================== DISBURSEMENT EVENTS ====================
    socket.on('disbursementCompleted', (data: any) => {
      console.log('💸 Disbursement completed:', data);
      
      if (!shouldShowNotification(data.memberId)) return;
      
      const memberName = data.memberName || 'A member';
      
      if (adminShow(() => {
        notifySuccess(
          '💸 Disbursement Completed',
          `KES ${data.amount?.toLocaleString() || 'N/A'} disbursed to ${memberName}`,
          data
        );
      })) return;
      else {
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
      // Only admin gets cycle update notifications
      if (isAdmin) {
        notifyInfo(
          '🔄 Cycle Updated',
          `Cycle ${data.cycleNumber || ''} has been updated`,
          data
        );
      }
    });

    socket.on('cycleUpdated', (data: any) => {
      console.log('🔄 Cycle updated:', data);
      // Only admin gets cycle update notifications
      if (isAdmin && data.cycleNumber) {
        notifyInfo(
          '🔄 Cycle Updated',
          `Cycle ${data.cycleNumber} stats updated`,
          data
        );
      }
    });

    socket.on('nextRecipientUpdated', (data: any) => {
      console.log('👤 Next recipient updated:', data);
      
      // Admin sees all
      if (isAdmin) {
        const recipientName = data.recipientName || 'A member';
        notifyInfo(
          '👤 Next Recipient Set',
          `${recipientName} is next for cycle disbursement`,
          data
        );
      }
      
      // The member who is next gets notified
      if (isForCurrentUser(data.nextRecipientId)) {
        notifySuccess(
          '🎉 You\'re Next!',
          'You are the next recipient for the cycle disbursement!',
          data
        );
      }
    });

    // ==================== MEMBER EVENTS (Admin only) ====================
    socket.on('member:new', (data: any) => {
      console.log('👤 New member:', data);
      if (isAdmin) {
        notifySuccess(
          '👤 New Member Joined',
          `${data.name || 'A new member'} has joined SMCF`,
          data
        );
      }
    });

    socket.on('memberUpdated', (data: any) => {
      console.log('👤 Member updated:', data);
      if (isAdmin) {
        const memberName = data.memberName || 'A member';
        notifyInfo(
          '👤 Member Updated',
          `${memberName}'s profile has been updated`,
          data
        );
      }
    });

    // ==================== WITHDRAWAL EVENTS ====================
    socket.on('withdrawalRequested', (data: any) => {
      console.log('💸 Withdrawal requested:', data);
      
      if (isAdmin) {
        const memberName = data.memberName || 'A member';
        notifyWarning(
          '💸 Withdrawal Request',
          `${memberName} requested a withdrawal of KES ${data.amount?.toLocaleString() || 'N/A'}`,
          data
        );
      }
    });

    socket.on('withdrawalProcessed', (data: any) => {
      console.log('💸 Withdrawal processed:', data);
      
      if (!shouldShowNotification(data.memberId)) return;
      
      const memberName = data.memberName || 'A member';
      
      if (adminShow(() => {
        notifySuccess(
          '💸 Withdrawal Processed',
          `Withdrawal of KES ${data.amount?.toLocaleString() || 'N/A'} processed for ${memberName}`,
          data
        );
      })) return;
      else {
        notifySuccess(
          '💸 Withdrawal Processed',
          `Your withdrawal of KES ${data.amount?.toLocaleString() || 'N/A'} has been processed`,
          data
        );
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
      socket.off('loanRequested');
      socket.off('disbursementCompleted');
      socket.off('cycle:updated');
      socket.off('cycleUpdated');
      socket.off('nextRecipientUpdated');
      socket.off('member:new');
      socket.off('memberUpdated');
      socket.off('withdrawalRequested');
      socket.off('withdrawalProcessed');
      socket.disconnect();
    };
  }, [currentUser, notifyPayment, notifySuccess, notifyWarning, notifyAnnouncement, notifyLoan, notifySavings, notifyInfo]);

  return socketRef.current;
}
