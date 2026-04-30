import { Button } from '../src/components/Button';
import { Toast, toast } from '../src/components/Toast';

export default {
  title: 'Toast',
  component: Toast,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const Example = () => (
  <div className="space-y-4">
    <Toast />
    <div className="flex flex-wrap gap-4">
      <Button
        onPress={() =>
          toast.success({
            title: 'Success!',
            message: 'Your action was completed successfully.',
          })
        }
      >
        Show Success Toast
      </Button>

      <Button
        variant="destructive"
        onPress={() =>
          toast.error({
            title: 'Error!',
            message: 'Something went wrong. Please try again.',
          })
        }
      >
        Show Error Toast
      </Button>

      <Button
        variant="outline"
        onPress={() =>
          toast.success({
            title: 'Simple Success',
            dismissable: true,
          })
        }
      >
        Dismissable Success
      </Button>

      <Button
        variant="outline"
        onPress={() =>
          toast.error({
            title: 'Persistent Error',
            message: 'This error will stay until dismissed.',
            dismissable: true,
          })
        }
      >
        Persistent Error
      </Button>
    </div>

    <div className="flex flex-wrap gap-4">
      <Button
        onPress={() =>
          toast.status({
            code: 404,
            message: 'The requested resource was not found.',
          })
        }
      >
        404 Error
      </Button>

      <Button
        onPress={() =>
          toast.status({
            code: 403,
            message: 'You do not have permission to access this resource.',
          })
        }
      >
        403 Forbidden
      </Button>

      <Button
        onPress={() =>
          toast.status({
            code: 500,
            message: 'Internal server error occurred.',
          })
        }
      >
        500 Error
      </Button>

      <Button onPress={() => toast.status({ code: 200 })}>
        200 Success (No Toast)
      </Button>
    </div>
  </div>
);

export const SuccessToast = () => (
  <div className="space-y-4">
    <Toast />
    <div className="flex gap-4">
      <Button
        onPress={() =>
          toast.success({
            title: 'Success!',
            message: 'Your changes have been saved.',
          })
        }
      >
        Basic Success
      </Button>

      <Button
        onPress={() =>
          toast.success({
            title: 'Upload Complete',
            message: 'Your file has been uploaded successfully.',
            dismissable: true,
          })
        }
      >
        Dismissable Success
      </Button>

      <Button
        onPress={() =>
          toast.success({
            message: 'Action completed without title.',
          })
        }
      >
        No Title
      </Button>
    </div>
  </div>
);

export const ErrorToast = () => (
  <div className="space-y-4">
    <Toast />
    <div className="flex gap-4">
      <Button
        variant="destructive"
        onPress={() =>
          toast.error({
            title: 'Error!',
            message: 'Something went wrong. Please try again.',
          })
        }
      >
        Basic Error
      </Button>

      <Button
        variant="destructive"
        onPress={() =>
          toast.error({
            title: 'Validation Error',
            message: 'Please check your input and try again.',
            dismissable: true,
          })
        }
      >
        Dismissable Error
      </Button>

      <Button
        variant="destructive"
        onPress={() =>
          toast.error({
            title: 'Network Error',
            dismissable: false,
          })
        }
      >
        Non-dismissable Error
      </Button>
    </div>
  </div>
);

export const StatusToasts = () => (
  <div className="space-y-4">
    <Toast />
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <h4 className="font-medium">HTTP Status Codes</h4>
        <div className="flex flex-col gap-2">
          <Button size="sm" onPress={() => toast.status({ code: 200 })}>
            200 OK
          </Button>

          <Button size="sm" onPress={() => toast.status({ code: 404 })}>
            404 Not Found
          </Button>

          <Button size="sm" onPress={() => toast.status({ code: 403 })}>
            403 Forbidden
          </Button>

          <Button size="sm" onPress={() => toast.status({ code: 500 })}>
            500 Internal Server Error
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Custom Messages</h4>
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            onPress={() =>
              toast.status({
                code: 404,
                message: 'The page you are looking for does not exist.',
              })
            }
          >
            Custom 404
          </Button>

          <Button
            size="sm"
            onPress={() =>
              toast.status({
                code: 403,
                message: 'Admin privileges required for this action.',
              })
            }
          >
            Custom 403
          </Button>

          <Button
            size="sm"
            onPress={() =>
              toast.status({
                code: 500,
                message: 'Database connection failed. Please try again later.',
              })
            }
          >
            Custom 500
          </Button>
        </div>
      </div>
    </div>
  </div>
);

export const MultipleToasts = () => (
  <div className="space-y-4">
    <Toast />
    <div className="flex gap-4">
      <Button
        onPress={() => {
          toast.success({ title: 'Toast 1', message: 'First toast' });
          setTimeout(
            () => toast.success({ title: 'Toast 2', message: 'Second toast' }),
            500,
          );
          setTimeout(
            () => toast.error({ title: 'Toast 3', message: 'Third toast' }),
            1000,
          );
        }}
      >
        Show Multiple Toasts
      </Button>

      <Button
        onPress={() => {
          for (let i = 1; i <= 5; i++) {
            setTimeout(() => {
              toast.success({
                title: `Toast ${i}`,
                message: `This is toast number ${i}`,
              });
            }, i * 300);
          }
        }}
      >
        Show 5 Toasts
      </Button>
    </div>
  </div>
);

export const ToastWithActions = () => (
  <div className="space-y-4">
    <Toast />
    <div className="flex flex-wrap gap-4">
      <Button
        onPress={() =>
          toast.success({
            title: 'File Upload Complete',
            message: 'Your document has been successfully uploaded.',
            actions: [<Button variant="default">View File</Button>],
          })
        }
      >
        Toast with One Action
      </Button>

      <Button
        onPress={() =>
          toast.success({
            title: 'Connection Restored',
            message: 'Your internet connection has been restored.',
            dismissable: true,
            actions: [
              <Button variant="default">Retry</Button>,
              <Button variant="outline">Dismiss</Button>,
            ],
          })
        }
      >
        Toast with Two Actions
      </Button>
    </div>
  </div>
);

export const SingleLineToasts = () => (
  <div className="space-y-4">
    <Toast />
    <div className="flex flex-wrap gap-4">
      <Button
        onPress={() =>
          toast.success({
            message:
              'Cooperativum mutualitas communis, equitatis prosperum. Societas nostra fundata est super principia cooperationis et mutuae auxilii.',
            actions: [
              <Button variant="default" size="sm">
                View profile
              </Button>,
            ],
          })
        }
      >
        Single Line Success with Action
      </Button>

      <Button
        onPress={() =>
          toast.success({
            message:
              'Cooperativum mutualitas communis, equitatis prosperum. Societas nostra fundata est super principia cooperationis et mutuae auxilii.',
            actions: [
              <Button variant="default" size="sm">
                View profile
              </Button>,
              <Button variant="outline" size="sm">
                Undo
              </Button>,
            ],
          })
        }
      >
        Single Line Success with Two Actions
      </Button>

      <Button
        variant="destructive"
        onPress={() =>
          toast.error({
            message:
              'Cooperativum mutualitas communis, equitatis prosperum. Societas nostra fundata est super principia cooperationis et mutuae auxilii.',
            dismissable: true,
          })
        }
      >
        Single Line Error with Dismiss
      </Button>

      <Button
        onPress={() =>
          toast.success({
            message: 'Message without actions. '.repeat(4),
          })
        }
      >
        Single Line No Actions
      </Button>
    </div>
  </div>
);
