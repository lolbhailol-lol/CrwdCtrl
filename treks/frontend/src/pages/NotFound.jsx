import Button from '../components/Button'

export default function NotFound() {
  return (
    <div className="container-narrow section-pad flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-display text-8xl font-extrabold text-forest-200 dark:text-forest-800">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-forest-800 dark:text-stone">
        Trail not found
      </h1>
      <p className="mt-3 max-w-md text-ink/60 dark:text-stone/60">
        This path doesn&apos;t lead anywhere in CrwdCtrl Treks. Head back to the directory and pick
        another route.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button to="/">Home</Button>
        <Button to="/explore" variant="secondary">
          Explore Treks
        </Button>
      </div>
    </div>
  )
}
