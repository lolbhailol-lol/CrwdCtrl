import Button from '../components/Button'

export default function NotFound() {
  return (
    <div className="container-narrow section-pad flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="text-8xl font-extrabold text-white/10">404</p>
      <h1 className="mt-4 text-3xl font-bold text-ink">Trail not found</h1>
      <p className="mt-3 max-w-md text-muted">
        This path doesn&apos;t lead anywhere in CrwdCtrl Treks.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button to="/">Home</Button>
        <Button to="/explore" variant="secondary">
          Explore
        </Button>
      </div>
    </div>
  )
}
