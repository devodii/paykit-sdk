import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react';
import { ExternalToast, Toaster as Sonner, toast } from 'sonner';

interface ToasterProps {
  className?: string;
  position?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
  expand?: boolean;
  duration?: number;
}

const Toaster = ({
  className,
  position = 'top-right',
  expand = false,
  duration = 4000,
  ...props
}: ToasterProps) => {
  return (
    <Sonner
      className={cn('toaster group', className)}
      position={position}
      expand={expand}
      richColors={false}
      closeButton={false}
      duration={duration}
      gap={12}
      toastOptions={{
        style: {
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          padding: 0,
        },
        className: 'toast-custom',
      }}
      {...props}
    />
  );
};

// Toast variants with icons and styling
const toastVariants = {
  success: {
    icon: CheckCircle,
    containerClass:
      'border-2 border-primary/30 bg-card/95 text-card-foreground ring-1 ring-primary/20 shadow-lg',
    iconContainerClass: 'bg-primary text-primary-foreground',
  },
  error: {
    icon: XCircle,
    containerClass:
      'border-2 border-destructive/30 bg-card/95 text-card-foreground ring-1 ring-destructive/20 shadow-lg',
    iconContainerClass: 'bg-destructive text-destructive-foreground',
  },
  warning: {
    icon: AlertCircle,
    containerClass:
      'border-2 border-primary/30 bg-card/95 text-card-foreground ring-1 ring-primary/20 shadow-lg',
    iconContainerClass: 'bg-primary text-primary-foreground',
  },
  info: {
    icon: Info,
    containerClass:
      'border-2 border-primary/30 bg-card/95 text-card-foreground ring-1 ring-primary/20 shadow-lg',
    iconContainerClass: 'bg-primary text-primary-foreground',
  },
  loading: {
    icon: Loader2,
    containerClass:
      'border-2 border-muted/50 bg-card/95 text-card-foreground ring-1 ring-muted/30 shadow-lg',
    iconContainerClass: 'bg-muted-foreground text-muted',
  },
};

// Custom toast component
const ToastComponent = ({
  variant,
  title,
  description,
}: {
  variant: keyof typeof toastVariants;
  title: string;
  description?: string;
}) => {
  const variantConfig = toastVariants[variant];
  const Icon = variantConfig.icon;
  const isLoading = variant === 'loading';

  return (
    <div
      className={cn(
        'relative flex max-w-[420px] min-w-[350px] items-start gap-3 rounded-lg border-2 p-4 shadow-lg backdrop-blur-md backdrop-saturate-150 transition-all',
        variantConfig.containerClass,
      )}
    >
      <div
        onClick={() => !isLoading && toast.dismiss()}
        className={cn(
          'absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full shadow-sm',
          variantConfig.iconContainerClass,
          !isLoading &&
            'cursor-pointer transition-transform hover:scale-105',
        )}
      >
        <Icon size={16} className={isLoading ? 'animate-spin' : ''} />
      </div>

      {/* Content */}
      <div className="flex-1 pr-4">
        {title && (
          <div className="mb-1 text-sm font-semibold">{title}</div>
        )}
        {description && (
          <div className="text-sm opacity-90">{description}</div>
        )}
      </div>
    </div>
  );
};

// Enhanced toast functions with modern styling
const createToast = (
  variant: keyof typeof toastVariants,
  title: string,
  description?: string,
  options?: ExternalToast,
) => {
  return toast.custom(
    () => (
      <ToastComponent
        variant={variant}
        title={title}
        description={description}
      />
    ),
    {
      duration: variant === 'loading' ? Infinity : 4000,
      ...options,
    },
  );
};

const Toast = {
  success: (dto: {
    title: string;
    description?: string;
    options?: ExternalToast;
  }) =>
    createToast('success', dto.title, dto.description, dto.options),

  error: (dto: {
    title: string;
    description?: string;
    options?: ExternalToast;
  }) => createToast('error', dto.title, dto.description, dto.options),

  warning: (dto: {
    title: string;
    description?: string;
    options?: ExternalToast;
  }) =>
    createToast('warning', dto.title, dto.description, dto.options),

  info: (dto: {
    title: string;
    description?: string;
    options?: ExternalToast;
  }) => createToast('info', dto.title, dto.description, dto.options),

  loading: (dto: {
    title: string;
    description?: string;
    options?: ExternalToast;
  }) =>
    createToast('loading', dto.title, dto.description, dto.options),

  promise: <T,>(
    promise: Promise<T>,
    {
      loading: loadingMessage = 'Loading...',
      success: successMessage = 'Success!',
      error: errorMessage = 'Something went wrong',
      ...options
    }: {
      loading?: string;
      success?: string | ((data: T) => string);
      error?: string | ((error: any) => string);
      [key: string]: any;
    } = {},
  ) => {
    // Show loading toast immediately
    const loadingToastId = createToast(
      'loading',
      loadingMessage,
      undefined,
      {
        duration: Infinity,
        ...options,
      },
    );

    // Handle promise resolution/rejection
    promise
      .then(data => {
        toast.dismiss(loadingToastId);
        const message =
          typeof successMessage === 'function'
            ? successMessage(data)
            : successMessage;
        createToast('success', message, undefined, options);
      })
      .catch(err => {
        toast.dismiss(loadingToastId);
        const message =
          typeof errorMessage === 'function'
            ? errorMessage(err)
            : errorMessage;
        createToast('error', message, undefined, options);
      });

    return loadingToastId;
  },

  custom: (jsx: React.ReactNode, options?: any) =>
    toast.custom(() => jsx as any, options),

  dismiss: (id?: string | number) => toast.dismiss(id),

  message: (message: string, options?: any) =>
    createToast('info', message, undefined, options),
};

export { Toaster, Toast, toast };

export type { ToasterProps };
