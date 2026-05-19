import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { OPERATIONAL_STAGES_ORDERED, OperationalStage } from '@/types/user';
import type { OperationalReadiness } from '@/types/user';
import type { OperationalUpsertPayload } from '@/lib/api';

const schema = z.object({
  current_stage: z.string().min(1, 'Stage is required'),
  primary_owner: z.string().optional(),
  secondary_owner: z.string().optional(),
  next_action: z.string().optional(),
  due_date: z.string().optional(),
  barriers: z.string().optional(),
  notes: z.string().optional(),
  estimated_patient_volume: z.coerce.number().int().min(0).optional(),
  center_role: z.enum(['Lead', 'Participating', 'Monitoring', 'Not Applicable']).optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
});

type FormValues = z.infer<typeof schema>;

interface OperationalFormProps {
  institutionId: string;
  therapyId: string;
  existing?: OperationalReadiness;
  onSubmit: (payload: OperationalUpsertPayload) => void;
  isSubmitting?: boolean;
  onCancel?: () => void;
}

export const OperationalForm: React.FC<OperationalFormProps> = ({
  institutionId,
  therapyId,
  existing,
  onSubmit,
  isSubmitting,
  onCancel,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      current_stage: existing?.current_stage ?? OperationalStage.AWARENESS,
      primary_owner: existing?.primary_owner ?? '',
      secondary_owner: existing?.secondary_owner ?? '',
      next_action: existing?.next_action ?? '',
      due_date: existing?.due_date ? existing.due_date.split('T')[0] : '',
      barriers: existing?.barriers ?? '',
      notes: existing?.notes ?? '',
      estimated_patient_volume: existing?.estimated_patient_volume,
      center_role: existing?.center_role,
      priority: existing?.priority ?? 'medium',
    },
  });

  const onFormSubmit = (values: FormValues) => {
    onSubmit({
      institution_id: institutionId,
      therapy_id: therapyId,
      ...values,
    });
  };

  const stageOptions = OPERATIONAL_STAGES_ORDERED.map((s) => ({ value: s, label: s }));
  const roleOptions = [
    { value: 'Lead', label: 'Lead Site' },
    { value: 'Participating', label: 'Participating' },
    { value: 'Monitoring', label: 'Monitoring Only' },
    { value: 'Not Applicable', label: 'Not Applicable' },
  ];
  const priorityOptions = [
    { value: 'high', label: 'High Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'low', label: 'Low Priority' },
  ];

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Current Stage"
          options={stageOptions}
          error={errors.current_stage?.message}
          required
          {...register('current_stage')}
        />
        <Select
          label="Priority"
          options={priorityOptions}
          error={errors.priority?.message}
          {...register('priority')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Primary Owner"
          placeholder="Name or team"
          error={errors.primary_owner?.message}
          {...register('primary_owner')}
        />
        <Input
          label="Secondary Owner"
          placeholder="Name or team"
          error={errors.secondary_owner?.message}
          {...register('secondary_owner')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Center Role"
          options={roleOptions}
          placeholder="Select role…"
          error={errors.center_role?.message}
          {...register('center_role')}
        />
        <Input
          label="Due Date"
          type="date"
          error={errors.due_date?.message}
          {...register('due_date')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Next Action</label>
        <textarea
          {...register('next_action')}
          rows={2}
          placeholder="Describe the next concrete action step…"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Barriers</label>
        <textarea
          {...register('barriers')}
          rows={2}
          placeholder="List any barriers or blockers…"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Additional notes or context…"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <Input
        label="Estimated Patient Volume (per year)"
        type="number"
        min={0}
        placeholder="e.g. 12"
        error={errors.estimated_patient_volume?.message}
        {...register('estimated_patient_volume')}
      />

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          {existing ? 'Update' : 'Save'} Operational Status
        </Button>
      </div>
    </form>
  );
};
