// `Surface` is an alias for shadcn's `Card` primitive — kept as a name for
// codemod compatibility with @op/ui call sites. New code can import the
// canonical shadcn names (Card, CardHeader, …) instead.

export {
  Card as Surface,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
