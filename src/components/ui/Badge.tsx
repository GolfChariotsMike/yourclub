import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'purple';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'gray', size = 'sm' }: BadgeProps) {
  const variants = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-700',
    purple: 'bg-purple-100 text-purple-800',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}

export function MemberStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    active: { label: 'Active', variant: 'success' },
    suspended: { label: 'Suspended', variant: 'danger' },
    pending: { label: 'Pending', variant: 'warning' },
    resigned: { label: 'Resigned', variant: 'gray' },
    deceased: { label: 'Deceased', variant: 'gray' },
  };
  const config = map[status] ?? { label: status, variant: 'gray' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function CompStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    draft: { label: 'Draft', variant: 'gray' },
    entries_open: { label: 'Entries Open', variant: 'info' },
    in_progress: { label: 'In Progress', variant: 'warning' },
    results_pending: { label: 'Results Pending', variant: 'purple' },
    finalised: { label: 'Finalised', variant: 'success' },
  };
  const config = map[status] ?? { label: status, variant: 'gray' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    draft: { label: 'Draft', variant: 'gray' },
    sent: { label: 'Sent', variant: 'info' },
    paid: { label: 'Paid', variant: 'success' },
    overdue: { label: 'Overdue', variant: 'danger' },
    void: { label: 'Void', variant: 'gray' },
  };
  const config = map[status] ?? { label: status, variant: 'gray' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
