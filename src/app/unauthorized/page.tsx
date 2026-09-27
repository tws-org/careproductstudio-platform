export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-semibold">Access Restricted</h1>
        <p className="text-gray-500">You do not have permission to access this page.</p>
      </div>
    </div>
  );
}
