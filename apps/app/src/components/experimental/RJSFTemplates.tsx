import type {
  BaseInputTemplateProps,
  FieldTemplateProps,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';

/**
 * Simple field template that adds spacing and dividers between fields.
 */
export const FieldTemplate = (props: FieldTemplateProps) => {
  const { children } = props;

  return (
    <div className="mb-6 border-b border-neutral-gray2 pb-6 last:mb-0 last:border-b-0 last:pb-0">
      {children}
    </div>
  );
};

/**
 * Object field template for rendering nested objects.
 */
export const ObjectFieldTemplate = (props: ObjectFieldTemplateProps) => {
  const { properties, title, description, idSchema } = props;

  // Skip root-level title/description since the page handles that
  const isRootSchema = idSchema?.$id === 'root';

  return (
    <div className="space-y-4">
      {title && !isRootSchema && (
        <h3 className="text-lg font-medium text-neutral-charcoal">{title}</h3>
      )}
      {description && !isRootSchema && (
        <p className="text-sm text-neutral-gray4">{description}</p>
      )}
      {properties.map((prop) => prop.content)}
    </div>
  );
};

/**
 * Base input template - passthrough.
 */
export const BaseInputTemplate = (props: BaseInputTemplateProps) => {
  return <>{props.children}</>;
};

export const CustomTemplates = {
  FieldTemplate,
  ObjectFieldTemplate,
  BaseInputTemplate,
};
