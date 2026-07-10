export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="prose prose-sm mx-auto min-h-screen max-w-2xl p-6 pt-12 dark:prose-invert [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6">
      {children}
    </main>
  );
}
