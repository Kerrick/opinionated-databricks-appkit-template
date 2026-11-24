import { Link, useLocation } from 'react-router';
import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@databricks/appkit-ui/react';
import { FileQuestionMark } from 'lucide-react';

export function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionMark />
        </EmptyMedia>
        <EmptyTitle role="heading" aria-level={1}>
          Page not found
        </EmptyTitle>
        <EmptyDescription>
          There is no page at <code className="break-all">{pathname}</code>
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
