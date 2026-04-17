import { Router } from 'express';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import Member from '../models/Member';
import MemberRegistrationForm from '../models/MemberRegistrationForm';

const router = Router();

type FormPayload = Record<string, any>;

const requiredFieldPaths = [
  'form.personalDetails.fullName',
  'form.personalDetails.nationalIdOrPassportNo',
  'form.personalDetails.dateOfBirth',
  'form.personalDetails.gender',
  'form.personalDetails.maritalStatus',
  'form.personalDetails.nationality',
  'form.personalDetails.placeOfBirth',
  'form.residentialAddress.physicalAddress',
  'form.residentialAddress.townCity',
  'form.residentialAddress.county',
  'form.residentialAddress.country',
  'form.residentialAddress.poBox',
  'form.residentialAddress.postalCode',
  'form.contactInformation.primaryMobileMpesa',
  'form.contactInformation.alternativePhone',
  'form.contactInformation.emailAddress',
  'form.employmentBusinessDetails.occupationJobTitle',
  'form.employmentBusinessDetails.monthlyGrossIncomeKes',
  'form.employmentBusinessDetails.employerBusinessName',
  'form.employmentBusinessDetails.workPhoneNo',
  'form.employmentBusinessDetails.employmentStatus',
  'form.employmentBusinessDetails.sourceOfFunds',
  'form.bankingDetails.bankName',
  'form.bankingDetails.branchName',
  'form.bankingDetails.accountNumber',
  'form.shareSubscriptionSavings.noOfSharesSubscribed',
  'form.shareSubscriptionSavings.totalShareCapitalKes',
  'form.shareSubscriptionSavings.initialSavingsDepositKes',
  'form.nextOfKinBeneficiary.fullName',
  'form.nextOfKinBeneficiary.relationship',
  'form.nextOfKinBeneficiary.phoneNumber',
  'form.nextOfKinBeneficiary.nationalIdNo',
  'form.nextOfKinBeneficiary.physicalAddress',
  'form.nextOfKinBeneficiary.emailIfAny',
  'form.declarationSignature.applicantSignatureName',
  'form.declarationSignature.dateSigned',
];

function getPathValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function isDataUrl(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function validatePayload(payload: FormPayload): string[] {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return ['Invalid payload'];
  }

  if (payload.termsAccepted !== true) {
    errors.push('You must accept the declaration terms before submitting.');
  }

  for (const path of requiredFieldPaths) {
    const value = getPathValue(payload, path);
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`Missing required field: ${path}`);
    }
  }

  if (!payload.passportPhoto || !isDataUrl(payload.passportPhoto)) {
    errors.push('Passport photo is required and must be an image.');
  }

  return errors;
}

function buildDefaultForm(member: any) {
  return {
    personalDetails: {
      fullName: member?.name || '',
      nationalIdOrPassportNo: member?.nationalId || '',
      dateOfBirth: member?.dateOfBirth ? new Date(member.dateOfBirth).toISOString().split('T')[0] : '',
      gender: member?.gender || '',
      maritalStatus: '',
      nationality: 'Kenyan',
      placeOfBirth: '',
    },
    residentialAddress: {
      physicalAddress: member?.county || '',
      townCity: '',
      county: member?.county || '',
      country: 'Kenya',
      poBox: '',
      postalCode: '',
    },
    contactInformation: {
      primaryMobileMpesa: member?.phone || '',
      alternativePhone: member?.phone || '',
      emailAddress: member?.email || '',
    },
    employmentBusinessDetails: {
      occupationJobTitle: member?.occupation || '',
      monthlyGrossIncomeKes: '',
      employerBusinessName: member?.employer || '',
      workPhoneNo: '',
      employmentStatus: '',
      sourceOfFunds: '',
    },
    bankingDetails: {
      bankName: '',
      branchName: '',
      accountNumber: '',
    },
    shareSubscriptionSavings: {
      noOfSharesSubscribed: '',
      totalShareCapitalKes: String(Number(member?.shares || 0) || ''),
      initialSavingsDepositKes: String(Number(member?.savings || 0) || ''),
    },
    nextOfKinBeneficiary: {
      fullName: '',
      relationship: '',
      phoneNumber: '',
      nationalIdNo: '',
      physicalAddress: '',
      emailIfAny: '',
    },
    declarationSignature: {
      acceptedAt: new Date(),
      applicantSignatureName: member?.name || '',
      dateSigned: new Date().toISOString().split('T')[0],
    },
  };
}

async function resolveMemberForRequest(req: AuthRequest) {
  let member = await Member.findOne({ userId: req.userId });
  if (member) return member;

  const userEmail = String(req.user?.email || '').trim().toLowerCase();
  if (!userEmail) return null;

  member = await Member.findOne({ email: userEmail });
  if (!member) return null;

  if (!member.userId && req.userId) {
    member.userId = req.userId as any;
    await member.save();
  }

  return member;
}

// @route   GET /api/registration-forms/me
// @desc    Get current member registration form submission state + defaults
// @access  Private (member)
router.get('/me', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await resolveMemberForRequest(req);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found for this account' });
    }

    const existing = await MemberRegistrationForm.findOne({ member: member._id })
      .select('-__v')
      .lean();

    const hasSubmitted = Boolean(existing && ['submitted', 'under_review', 'approved'].includes(existing.status));

    return res.json({
      success: true,
      data: {
        hasSubmitted,
        memberDefaults: {
          memberId: member.memberId,
          memberName: member.name,
          passportPhoto: member.profilePhoto || member.docPassportPhoto || null,
          profilePhoto: member.profilePhoto || null,
          docPassportPhoto: member.docPassportPhoto || null,
        },
        formDefaults: buildDefaultForm(member),
        submission: existing || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/registration-forms/me/submit
// @desc    Submit the digital member registration form
// @access  Private (member)
router.post('/me/submit', protect, async (req: AuthRequest, res, next) => {
  try {
    const member = await resolveMemberForRequest(req);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found for this account' });
    }

    const payload = req.body as FormPayload;
    const validationErrors = validatePayload(payload);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: validationErrors[0], errors: validationErrors });
    }

    const existing = await MemberRegistrationForm.findOne({ member: member._id });
    if (existing && ['submitted', 'under_review', 'approved'].includes(existing.status)) {
      return res.status(409).json({
        success: false,
        message: 'You already submitted your registration form. The SACCO team is reviewing it.',
      });
    }

    const documentToSave = {
      member: member._id,
      userId: req.userId,
      saccoMemberId: member.memberId,
      memberName: payload.form.personalDetails.fullName?.trim() || member.name,
      status: 'submitted' as const,
      submittedAt: new Date(),
      termsAccepted: true,
      passportPhoto: payload.passportPhoto,
      form: {
        ...payload.form,
        declarationSignature: {
          ...payload.form.declarationSignature,
          acceptedAt: new Date(),
        },
      },
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
    };

    const saved = await MemberRegistrationForm.findOneAndUpdate(
      { member: member._id },
      documentToSave,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    if (!member.profilePhoto && payload.passportPhoto) {
      await Member.findByIdAndUpdate(member._id, { profilePhoto: payload.passportPhoto, docPassportPhoto: payload.passportPhoto });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration form submitted successfully.',
      data: {
        id: saved._id,
        status: saved.status,
        submittedAt: saved.submittedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/registration-forms
// @desc    List all submitted member registration forms
// @access  Private (admin/staff)
router.get('/', protect, authorize('admin', 'credit_officer', 'treasurer', 'auditor'), async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim();
    const query: Record<string, any> = {};
    if (status) query.status = status;

    const forms = await MemberRegistrationForm.find(query)
      .select('_id saccoMemberId memberName status submittedAt termsAccepted reviewedAt')
      .sort({ submittedAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: forms.map((f) => ({
        id: String(f._id),
        saccoMemberId: f.saccoMemberId,
        memberName: f.memberName,
        status: f.status,
        termsAccepted: Boolean(f.termsAccepted),
        submittedAt: f.submittedAt,
        reviewedAt: f.reviewedAt || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/registration-forms/:id
// @desc    Get a single submitted member registration form
// @access  Private (admin/staff)
router.get('/:id', protect, authorize('admin', 'credit_officer', 'treasurer', 'auditor'), async (req, res, next) => {
  try {
    const form = await MemberRegistrationForm.findById(req.params.id)
      .select('-__v')
      .lean();

    if (!form) {
      return res.status(404).json({ success: false, message: 'Registration form not found' });
    }

    return res.json({ success: true, data: form });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/registration-forms/:id/status
// @desc    Update registration form review status
// @access  Private (admin)
router.patch('/:id/status', protect, authorize('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!['under_review', 'approved', 'rejected', 'submitted'].includes(String(status))) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const updated = await MemberRegistrationForm.findByIdAndUpdate(
      req.params.id,
      {
        status,
        reviewNotes: typeof reviewNotes === 'string' ? reviewNotes.trim() || null : null,
        reviewedAt: new Date(),
        reviewedBy: req.userId,
      },
      { new: true }
    ).select('_id status reviewedAt reviewNotes');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Registration form not found' });
    }

    return res.json({
      success: true,
      data: {
        id: String(updated._id),
        status: updated.status,
        reviewedAt: updated.reviewedAt,
        reviewNotes: updated.reviewNotes,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
