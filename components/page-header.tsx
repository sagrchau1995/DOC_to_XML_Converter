export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="border-b border-line pb-5">
      <p className="text-xs font-bold uppercase text-muted">Professional ASYCUDA XML workflow</p>
      <h2 className="mt-2 text-3xl font-black tracking-normal">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p>
    </header>
  );
}
