"use client";

function CopyrightYear() {
  return <>{new Date().getFullYear()}</>;
}

export default function Page() {
  return (
    <div>
      {/* Tu contenido de la página aquí */}
      <CopyrightYear />
    </div>
  );
}

