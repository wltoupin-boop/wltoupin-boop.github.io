import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Building2, Bell } from 'lucide-react';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { useInstitution, useUpdateInstitution } from '@/hooks/useInstitution';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { InstitutionType } from '@/types/user';

// ─── Profile form ────────────────────────────────────────────────────────────
const profileSchema = z.object({
  display_name: z.string().min(1, 'Name is required'),
  title: z.string().optional(),
  department: z.string().optional(),
});
type ProfileValues = z.infer<typeof profileSchema>;

// ─── Notification form ────────────────────────────────────────────────────────
const notifSchema = z.object({
  email_milestones: z.boolean(),
  email_regulatory_updates: z.boolean(),
  email_news: z.boolean(),
  in_app_milestones: z.boolean(),
  in_app_regulatory_updates: z.boolean(),
  notification_frequency: z.enum(['immediate', 'daily', 'weekly']),
});
type NotifValues = z.infer<typeof notifSchema>;

export const SettingsPage: React.FC = () => {
  const { appUser, firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const institutionId = appUser?.institution_id ?? '';

  const { data: institution } = useInstitution(institutionId);
  const updateInstitution = useUpdateInstitution();

  const updateProfile = useMutation({
    mutationFn: usersApi.updateMe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.me() });
    },
  });

  const {
    register: regProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: appUser?.display_name ?? '',
      title: appUser?.title ?? '',
      department: appUser?.department ?? '',
    },
  });

  const {
    register: regNotif,
    handleSubmit: handleNotifSubmit,
    formState: { isSubmitting: notifSubmitting },
  } = useForm<NotifValues>({
    defaultValues: {
      email_milestones: appUser?.notification_preferences?.email_milestones ?? true,
      email_regulatory_updates: appUser?.notification_preferences?.email_regulatory_updates ?? true,
      email_news: appUser?.notification_preferences?.email_news ?? false,
      in_app_milestones: appUser?.notification_preferences?.in_app_milestones ?? true,
      in_app_regulatory_updates: appUser?.notification_preferences?.in_app_regulatory_updates ?? true,
      notification_frequency: appUser?.notification_preferences?.notification_frequency ?? 'daily',
    },
  });

  const institutionTypeOptions = Object.values(InstitutionType).map((v) => ({
    value: v,
    label: v,
  }));

  if (!appUser) return <Spinner size="lg" />;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="mt-0.5 text-sm text-neutral-500">Manage your profile and preferences</p>
      </div>

      <Tabs defaultTab="profile">
        <TabList>
          <Tab id="profile" icon={<User className="h-4 w-4" />}>Profile</Tab>
          <Tab id="institution" icon={<Building2 className="h-4 w-4" />}>Institution</Tab>
          <Tab id="notifications" icon={<Bell className="h-4 w-4" />}>Notifications</Tab>
        </TabList>

        {/* Profile tab */}
        <TabPanel id="profile" className="pt-5">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-neutral-900">Personal Information</h2>
            </CardHeader>
            <CardBody>
              <form
                onSubmit={handleProfileSubmit((values) => {
                  updateProfile.mutate(values as Partial<typeof appUser>);
                })}
                className="space-y-4"
              >
                <Input
                  label="Email"
                  type="email"
                  value={firebaseUser?.email ?? ''}
                  readOnly
                  disabled
                  helperText="Email cannot be changed (managed by Firebase Auth)"
                />
                <Input
                  label="Display Name"
                  error={profileErrors.display_name?.message}
                  required
                  {...regProfile('display_name')}
                />
                <Input
                  label="Title / Role"
                  placeholder="e.g. Director of Cell Therapy"
                  error={profileErrors.title?.message}
                  {...regProfile('title')}
                />
                <Input
                  label="Department"
                  placeholder="e.g. Hematology & Oncology"
                  error={profileErrors.department?.message}
                  {...regProfile('department')}
                />
                <div className="flex items-center gap-3">
                  <Button type="submit" loading={profileSubmitting || updateProfile.isPending}>
                    Save Profile
                  </Button>
                  {updateProfile.isSuccess && (
                    <span className="text-sm text-accent-600">Saved!</span>
                  )}
                </div>
              </form>
            </CardBody>
          </Card>
        </TabPanel>

        {/* Institution tab */}
        <TabPanel id="institution" className="pt-5">
          {!institutionId ? (
            <Card>
              <CardBody>
                <p className="text-sm text-neutral-500">
                  No institution linked. Contact an administrator to link your account.
                </p>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-neutral-900">Institution Details</h2>
              </CardHeader>
              <CardBody>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const data = Object.fromEntries(new FormData(form));
                    updateInstitution.mutate({ id: institutionId, data: data as Partial<typeof institution> });
                  }}
                  className="space-y-4"
                >
                  <Input
                    label="Institution Name"
                    name="name"
                    defaultValue={institution?.name ?? ''}
                    required
                  />
                  <Select
                    label="Institution Type"
                    name="type"
                    options={institutionTypeOptions}
                    defaultValue={institution?.type ?? ''}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="City" name="city" defaultValue={institution?.city ?? ''} />
                    <Input label="State" name="state" defaultValue={institution?.state ?? ''} />
                  </div>
                  <Input
                    label="Contact Email"
                    name="contact_email"
                    type="email"
                    defaultValue={institution?.contact_email ?? ''}
                  />
                  <Input
                    label="Website"
                    name="website"
                    type="url"
                    placeholder="https://…"
                    defaultValue={institution?.website ?? ''}
                  />
                  <div className="flex items-center gap-3">
                    <Button type="submit" loading={updateInstitution.isPending}>
                      Save Institution
                    </Button>
                    {updateInstitution.isSuccess && (
                      <span className="text-sm text-accent-600">Saved!</span>
                    )}
                  </div>
                </form>
              </CardBody>
            </Card>
          )}
        </TabPanel>

        {/* Notifications tab */}
        <TabPanel id="notifications" className="pt-5">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-neutral-900">Notification Preferences</h2>
            </CardHeader>
            <CardBody>
              <form
                onSubmit={handleNotifSubmit((values) => {
                  updateProfile.mutate({
                    notification_preferences: values,
                  } as Partial<typeof appUser>);
                })}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">Email Notifications</h3>
                  <div className="space-y-2">
                    {[
                      { name: 'email_milestones' as const, label: 'PDUFA dates and milestones' },
                      { name: 'email_regulatory_updates' as const, label: 'Regulatory status updates' },
                      { name: 'email_news' as const, label: 'News and literature updates' },
                    ].map((item) => (
                      <label key={item.name} className="flex cursor-pointer items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300 text-primary-600"
                          {...regNotif(item.name)}
                        />
                        <span className="text-neutral-700">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 mb-3">In-App Notifications</h3>
                  <div className="space-y-2">
                    {[
                      { name: 'in_app_milestones' as const, label: 'Milestone alerts' },
                      { name: 'in_app_regulatory_updates' as const, label: 'Regulatory updates' },
                    ].map((item) => (
                      <label key={item.name} className="flex cursor-pointer items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300 text-primary-600"
                          {...regNotif(item.name)}
                        />
                        <span className="text-neutral-700">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Select
                  label="Notification Frequency"
                  options={[
                    { value: 'immediate', label: 'Immediate' },
                    { value: 'daily', label: 'Daily Digest' },
                    { value: 'weekly', label: 'Weekly Summary' },
                  ]}
                  {...regNotif('notification_frequency')}
                />

                <div className="flex items-center gap-3">
                  <Button type="submit" loading={notifSubmitting || updateProfile.isPending}>
                    Save Preferences
                  </Button>
                  {updateProfile.isSuccess && (
                    <span className="text-sm text-accent-600">Saved!</span>
                  )}
                </div>
              </form>
            </CardBody>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
};
