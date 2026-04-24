import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function parseAttachments(value: string | string[] | null | undefined): string[] {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export type KycStatus = 'pending' | 'approved' | 'rejected';

export interface KycApplication {
    id: string;
    name: string;
    city: string;
    license: string;
    attachments: string[];
    status: KycStatus;
}

export interface UserRecord {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'pro' | 'admin';
    location: string;
    blocked: boolean;
    verified: boolean;
    licenseNumber?: string;
    specialty?: string;
    rating?: number;
    openCases?: number;
    freeConsultsRemaining?: number;
    subscriptionTier: 'basic' | 'pro' | 'enterprise';
    notificationsEnabled: boolean;
    accountBalance: number;
    licenseStatus: 'pending' | 'verified' | 'rejected';
    notes: string;
}

export interface FeatureFlag {
    key: string;
    label: string;
    description: string;
    enabled: boolean;
}

export interface SupportTicket {
    id: string;
    requester: string;
    subject: string;
    status: 'open' | 'pending' | 'resolved' | 'escalated';
    priority: 'high' | 'medium' | 'low';
    createdAt: string;
}

export interface PolicySetting {
    key: string;
    label: string;
    value: string;
    description: string;
}

export interface SystemSettings {
    maintenanceMode: boolean;
    announcement: string;
    offlineMessage: string;
    supportEmail: string;
}

export interface PaymentGateway {
    key: string;
    label: string;
    enabled: boolean;
    feePercent: number;
}

export interface AiSettings {
    enabled: boolean;
    topK: number;
    fallbackMode: boolean;
    maxTokens: number;
}

export interface WorkflowSettings {
    allowNewCases: boolean;
    enforceSignedDocs: boolean;
    autoAssignLawyers: boolean;
    openCasesPerLawyer: number;
}

export interface NotificationTemplate {
    key: string;
    label: string;
    value: string;
    active: boolean;
}

export interface ModerationRule {
    id: string;
    type: 'bannedWord' | 'sensitiveTopic';
    value: string;
    active: boolean;
}

export interface LegalDoc {
    id: string;
    title: string;
    law: string;
    article: string;
    category: string;
    summary: string;
    source: string;
}

export interface SecurityAlert {
    id: string;
    category: 'سجل دخول مشبوه' | 'تذكرة تصعيد' | 'انتهاك امتثال';
    title: string;
    detail: string;
    severity: 'high' | 'medium' | 'low';
    time: string;
}

export interface AuditRecord {
    id: string;
    type: 'security' | 'kyc' | 'transaction' | 'ai' | 'system';
    category: string;
    actor: string;
    message: string;
    time: string;
}

export interface TransactionRecord {
    id: string;
    label: string;
    source: string;
    amount: number;
    type: 'credit' | 'debit';
    status: 'completed' | 'pending' | 'failed';
}

export interface AdminMetrics {
    activeUsers: number;
    dailyVolume: number;
    avgResponseTimeMs: number;
    ragAccuracy: number;
    docsSynced: number;
    suspiciousEvents: number;
    openEscalations: number;
    complianceFlags: number;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
    const usersCount = await prisma.user.count();
    const suspiciousCount = 3; // Mocking for now, could query security log table
    return {
        activeUsers: usersCount,
        dailyVolume: 14500000,
        avgResponseTimeMs: 1180,
        ragAccuracy: 92,
        docsSynced: 870,
        suspiciousEvents: suspiciousCount,
        openEscalations: 2,
        complianceFlags: 5,
    };
}

export async function getKycApplications(search?: string, status?: KycStatus): Promise<KycApplication[]> {
    const applications = await prisma.kycApplication.findMany({
        where: {
            status: status || undefined,
            OR: search ? [
                { name: { contains: search } },
                { city: { contains: search } }
            ] : undefined
        }
    });
    return applications.map((application: any) => ({
        ...application,
        attachments: parseAttachments(application.attachments),
    })) as KycApplication[];
}

export async function updateKycApplication(id: string, status: KycStatus): Promise<KycApplication | null> {
    const updated = await prisma.kycApplication.update({
        where: { id },
        data: { status }
    });

    // Create Audit Log
    await prisma.transaction.create({
        data: {
            userId: updated.userId,
            amount: 0,
            label: `KYC ${status === 'approved' ? 'Approval' : 'Rejection'} for ${updated.name}`,
            source: 'System Admin',
            type: 'system'
        }
    });

    return {
        ...(updated as any),
        attachments: parseAttachments((updated as any).attachments),
    } as KycApplication;
}

export async function getUsers(): Promise<UserRecord[]> {
    const dbUsers = await prisma.user.findMany({
        include: { lawyerProfile: true }
    });

    return dbUsers.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as any,
        location: u.location || '',
        blocked: u.blocked,
        verified: u.verified,
        licenseNumber: u.lawyerProfile?.licenseNumber || undefined,
        subscriptionTier: u.subscriptionTier as any,
        accountBalance: u.accountBalance,
        notes: u.notes || '',
        notificationsEnabled: u.notificationsEnabled,
        licenseStatus: (u.lawyerProfile?.licenseStatus as any) || 'pending'
    }));
}

export async function getUserById(id: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({
        where: { id },
        include: { lawyerProfile: true }
    });
    if (!user) return null;
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as any,
        location: user.location || '',
        blocked: user.blocked,
        verified: user.verified,
        licenseNumber: user.lawyerProfile?.licenseNumber,
        specialty: user.lawyerProfile?.specialty,
        rating: user.lawyerProfile?.rating,
        openCases: user.lawyerProfile?.openCases,
        freeConsultsRemaining: undefined,
        subscriptionTier: user.subscriptionTier as any,
        accountBalance: user.accountBalance,
        notes: user.notes || '',
        notificationsEnabled: user.notificationsEnabled,
        licenseStatus: (user.lawyerProfile?.licenseStatus as any) || 'pending'
    };
}

export async function updateUserProfile(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
    try {
        const user = await prisma.user.update({
            where: { id },
            data: {
                name: updates.name,
                location: updates.location,
                notificationsEnabled: updates.notificationsEnabled,
                notes: updates.notes,
            },
            include: { lawyerProfile: true }
        });

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as any,
            location: user.location || '',
            blocked: user.blocked,
            verified: user.verified,
            licenseNumber: user.lawyerProfile?.licenseNumber,
            specialty: user.lawyerProfile?.specialty,
            rating: user.lawyerProfile?.rating,
            openCases: user.lawyerProfile?.openCases,
            freeConsultsRemaining: undefined,
            subscriptionTier: user.subscriptionTier as any,
            accountBalance: user.accountBalance,
            notes: user.notes || '',
            notificationsEnabled: user.notificationsEnabled,
            licenseStatus: (user.lawyerProfile?.licenseStatus as any) || 'pending'
        };
    } catch (error) {
        console.error('Error updating user profile:', error);
        return null;
    }
}

export function updateUserRole(id: string, role: UserRecord['role']): UserRecord | null {
    const index = users.findIndex((user: UserRecord) => user.id === id);
    if (index < 0) {
        return null;
    }
    users[index] = { ...users[index], role };
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تحديث صلاحية المستخدم',
        actor: 'مدير النظام',
        message: `تم تحديث صلاحية ${users[index].name} إلى ${role}.`,
        time: 'الآن',
    });
    return users[index];
}

export function toggleUserBlock(id: string): UserRecord | null {
    const index = users.findIndex((user: UserRecord) => user.id === id);
    if (index < 0) {
        return null;
    }
    users[index] = { ...users[index], blocked: !users[index].blocked };
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'security',
        category: users[index].blocked ? 'حظر مستخدم' : 'رفع حظر مستخدم',
        actor: 'مدير النظام',
        message: `${users[index].blocked ? 'تم حظر' : 'تم رفع الحظر عن'} ${users[index].name}.`,
        time: 'الآن',
    });
    return users[index];
}

export function getFeatureFlags(): FeatureFlag[] {
    return featureFlags;
}

export function updateFeatureFlag(key: string, enabled: boolean): FeatureFlag | null {
    const index = featureFlags.findIndex((flag: FeatureFlag) => flag.key === key);
    if (index < 0) {
        return null;
    }
    featureFlags[index] = { ...featureFlags[index], enabled };
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تحديث علم ميزة',
        actor: 'مدير النظام',
        message: `${featureFlags[index].label} تم ${enabled ? 'تمكينه' : 'تعطيله'}.`,
        time: 'الآن',
    });
    return featureFlags[index];
}

export function getSupportTickets(): SupportTicket[] {
    return supportTickets;
}

export function updateSupportTicket(id: string, status: SupportTicket['status']): SupportTicket | null {
    const index = supportTickets.findIndex((ticket: SupportTicket) => ticket.id === id);
    if (index < 0) {
        return null;
    }
    supportTickets[index] = { ...supportTickets[index], status };
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تحديث تذكرة الدعم',
        actor: 'مدير النظام',
        message: `تم تغيير حالة التذكرة ${supportTickets[index].subject} إلى ${status}.`,
        time: 'الآن',
    });
    return supportTickets[index];
}

export function getPolicies(): PolicySetting[] {
    return systemPolicies;
}

export function updatePolicySetting(key: string, value: string): PolicySetting | null {
    const index = systemPolicies.findIndex((policy: PolicySetting) => policy.key === key);
    if (index < 0) {
        return null;
    }
    systemPolicies[index] = { ...systemPolicies[index], value };
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تغيير سياسة',
        actor: 'مدير النظام',
        message: `تم تحديث ${systemPolicies[index].label} إلى ${value}.`,
        time: 'الآن',
    });
    return systemPolicies[index];
}

export function getSecurityAlerts(): SecurityAlert[] {
    return securityAlerts;
}

export function getAuditLogs(type?: string): AuditRecord[] {
    if (!type || type === 'all') {
        return auditLogs;
    }
    return auditLogs.filter((record) => record.type === type);
}

export function getTransactionRecords(): TransactionRecord[] {
    return transactionRecords;
}

export function getExportCsv(type: 'kyc' | 'transactions'): string {
    if (type === 'transactions') {
        const header = 'رقم العملية,الوصف,المصدر,المبلغ,النوع,الحالة\n';
        const rows = transactionRecords
            .map((transaction) => `${transaction.id},${transaction.label},${transaction.source},${transaction.amount},${transaction.type},${transaction.status}`)
            .join('\n');
        return `${header}${rows}`;
    }

    const header = 'رقم النقابة,اسم المحامي,المدينة,المستندات,الحالة\n';
    const rows = kycApplications
        .map((application: KycApplication) =>
            `${application.id},${application.name},${application.city},"${application.attachments.join(' | ')}",${application.status}`
        )
        .join('\n');
    return `${header}${rows}`;
}

export function getSystemSettings(): SystemSettings {
    return systemSettings;
}

export function updateSystemSettings(settings: Partial<SystemSettings>): SystemSettings {
    Object.assign(systemSettings, settings);
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تحديث إعدادات النظام',
        actor: 'مدير النظام',
        message: `تم تحديث إعدادات النظام الرئيسية.`,
        time: 'الآن',
    });
    return systemSettings;
}

export function getAiSettings(): AiSettings {
    return aiSettings;
}

export function updateAiSettings(settings: Partial<AiSettings>): AiSettings {
    Object.assign(aiSettings, settings);
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تحديث إعدادات الذكاء الاصطناعي',
        actor: 'مدير النظام',
        message: `تم تحديث إعدادات الذكاء الاصطناعي.`,
        time: 'الآن',
    });
    return aiSettings;
}

export function getPaymentGateways(): PaymentGateway[] {
    return paymentGateways;
}

export function updatePaymentGateway(key: string, enabled: boolean, feePercent?: number): PaymentGateway | null {
    const index = paymentGateways.findIndex((gateway) => gateway.key === key);
    if (index < 0) {
        return null;
    }
    paymentGateways[index] = {
        ...paymentGateways[index],
        enabled,
        feePercent: feePercent !== undefined ? feePercent : paymentGateways[index].feePercent,
    };
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تحديث بوابة الدفع',
        actor: 'مدير النظام',
        message: `تم تحديث بوابة الدفع ${paymentGateways[index].label}.`,
        time: 'الآن',
    });
    return paymentGateways[index];
}

export function getWorkflowSettings(): WorkflowSettings {
    return workflowSettings;
}

export function updateWorkflowSettings(settings: Partial<WorkflowSettings>): WorkflowSettings {
    Object.assign(workflowSettings, settings);
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تحديث إعدادات سير العمل',
        actor: 'مدير النظام',
        message: `تم تحديث إعدادات سير العمل.`,
        time: 'الآن',
    });
    return workflowSettings;
}

export function getNotificationTemplates(): NotificationTemplate[] {
    return notificationTemplates;
}

export function updateNotificationTemplate(key: string, partial: Partial<NotificationTemplate>): NotificationTemplate | null {
    const index = notificationTemplates.findIndex((template) => template.key === key);
    if (index < 0) {
        return null;
    }
    notificationTemplates[index] = {
        ...notificationTemplates[index],
        ...partial,
    };
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تحديث رسالة النظام',
        actor: 'مدير النظام',
        message: `تم تحديث ${notificationTemplates[index].label}.`,
        time: 'الآن',
    });
    return notificationTemplates[index];
}

export function getModerationRules(): ModerationRule[] {
    return moderationRules;
}

export function updateModerationRule(id: string, partial: Partial<ModerationRule>): ModerationRule | null {
    const index = moderationRules.findIndex((rule: ModerationRule) => rule.id === id);
    if (index < 0) {
        return null;
    }
    moderationRules[index] = {
        ...moderationRules[index],
        ...partial,
    };
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'تحديث قواعد المراقبة',
        actor: 'مدير النظام',
        message: `تم تحديث قاعدة ${moderationRules[index].value}.`,
        time: 'الآن',
    });
    return moderationRules[index];
}

export function addModerationRule(rule: Omit<ModerationRule, 'id'>): ModerationRule {
    const newRule: ModerationRule = {
        id: `m-${Date.now()}`,
        ...rule,
    };
    moderationRules.unshift(newRule);
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'قواعد المراقبة',
        actor: 'مدير النظام',
        message: `تمت إضافة قاعدة ${newRule.value}.`,
        time: 'الآن',
    });
    return newRule;
}

export function deleteModerationRule(id: string): boolean {
    const index = moderationRules.findIndex((rule) => rule.id === id);
    if (index < 0) {
        return false;
    }
    const deleted = moderationRules.splice(index, 1)[0];
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'قواعد المراقبة',
        actor: 'مدير النظام',
        message: `تمت إزالة قاعدة ${deleted.value}.`,
        time: 'الآن',
    });
    return true;
}

export function getLegalDocs(): LegalDoc[] {
    return legalDocs;
}

export function addLegalDoc(doc: Omit<LegalDoc, 'id'>): LegalDoc {
    const newDoc: LegalDoc = { id: `law-${Date.now()}`, ...doc };
    legalDocs.unshift(newDoc);
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'إدارة مصادر الوثائق',
        actor: 'مدير النظام',
        message: `تمت إضافة وثيقة قانونية جديدة: ${newDoc.title}.`,
        time: 'الآن',
    });
    return newDoc;
}

export function updateLegalDoc(id: string, settings: Partial<Omit<LegalDoc, 'id'>>): LegalDoc | null {
    const index = legalDocs.findIndex((doc: LegalDoc) => doc.id === id);
    if (index < 0) {
        return null;
    }
    legalDocs[index] = { ...legalDocs[index], ...settings };
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'إدارة مصادر الوثائق',
        actor: 'مدير النظام',
        message: `تم تحديث الوثيقة القانونية ${legalDocs[index].title}.`,
        time: 'الآن',
    });
    return legalDocs[index];
}

export function deleteLegalDoc(id: string): boolean {
    const index = legalDocs.findIndex((doc: LegalDoc) => doc.id === id);
    if (index < 0) {
        return false;
    }
    const deleted = legalDocs.splice(index, 1)[0];
    auditLogs.unshift({
        id: `l-${Date.now()}`,
        type: 'system',
        category: 'إدارة مصادر الوثائق',
        actor: 'مدير النظام',
        message: `تم حذف الوثيقة القانونية ${deleted.title}.`,
        time: 'الآن',
    });
    return true;
}

// Mock data definitions
let users: UserRecord[] = [];
let auditLogs: AuditRecord[] = [];
let featureFlags: FeatureFlag[] = [];
let supportTickets: SupportTicket[] = [];
let systemPolicies: PolicySetting[] = [];
let securityAlerts: SecurityAlert[] = [];
let transactionRecords: TransactionRecord[] = [];
let kycApplications: KycApplication[] = [];
let systemSettings: SystemSettings = {
    maintenanceMode: false,
    announcement: '',
    offlineMessage: '',
    supportEmail: ''
};
let aiSettings: AiSettings = {
    enabled: true,
    topK: 5,
    fallbackMode: false,
    maxTokens: 1000
};
let paymentGateways: PaymentGateway[] = [];
let workflowSettings: WorkflowSettings = {
    allowNewCases: true,
    enforceSignedDocs: false,
    autoAssignLawyers: false,
    openCasesPerLawyer: 10
};
let notificationTemplates: NotificationTemplate[] = [];
let moderationRules: ModerationRule[] = [];
let legalDocs: LegalDoc[] = [];
