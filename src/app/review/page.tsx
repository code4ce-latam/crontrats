"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowRight, FileText, Highlighter, Anchor } from "lucide-react";

export default function ReviewPage() {
  const versions = [
    {
      id: "original_word",
      title: "Versión Original Word",
      description: "Versión base con anclajes posicionales y comentarios. Sin funcionalidad de resaltado.",
      route: "/review_original_word",
      icon: FileText,
      features: [
        "Anclajes posicionales (x, y)",
        "Comentarios anclados",
        "Carga de documentos Word (.docx)",
        "Edición inline de comentarios",
      ],
    },
    {
      id: "word_resaltador",
      title: "Versión con Resaltador",
      description: "Incluye todas las funcionalidades de la versión original más herramienta de resaltado de texto independiente.",
      route: "/review_word_resaltador",
      icon: Highlighter,
      features: [
        "Anclajes posicionales (x, y)",
        "Comentarios anclados",
        "Carga de documentos Word (.docx)",
        "Edición inline de comentarios",
        "Resaltado de texto independiente",
        "Selección precisa de texto",
        "Eliminación de highlights con doble clic",
      ],
    },
    {
      id: "word_resaltador_with_anclaje",
      title: "Versión con Resaltador y Anclaje",
      description: "Versión completa que combina resaltado de texto independiente con anclajes posicionales y comentarios.",
      route: "/review_word_resaltador_with_anclaje",
      icon: Anchor,
      features: [
        "Resaltado de texto independiente",
        "Anclajes posicionales (x, y)",
        "Comentarios anclados",
        "Carga de documentos Word (.docx)",
        "Edición inline de comentarios",
        "Eliminación de highlights con botón en hover",
        "Creación automática de comentario al resaltar",
      ],
    },
    {
      id: "pdf_resaltador_with_anclaje",
      title: "Versión PDF con Resaltador y Anclaje",
      description: "Versión completa para PDF que combina resaltado de texto independiente con anclajes posicionales y comentarios.",
      route: "/review_pdf_resaltador_with_anclaje",
      icon: Anchor,
      features: [
        "Resaltado de texto con pintura estilo paintbrush",
        "Anclajes posicionales (x, y)",
        "Comentarios anclados",
        "Carga de documentos PDF",
        "Edición inline de comentarios",
        "Eliminación de highlights con botón en hover",
        "Creación automática de comentario al resaltar",
        "Zoom in/out/reset (50% - 300%)",
        "Herramienta de pan para mover el documento",
        "Cursor de lápiz en modo resaltar",
        "Preview en tiempo real mientras se pinta",
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 p-6">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-zinc-900">
            Editor de Comentarios
          </h1>
          <p className="text-zinc-600">
            Selecciona una versión para comenzar
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {versions.map((version) => {
            const Icon = version.icon;
            return (
              <Card
                key={version.id}
                className="group transition-all duration-200 hover:shadow-lg hover:shadow-zinc-200/50"
              >
                <CardHeader>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="rounded-lg bg-zinc-100 p-2 group-hover:bg-zinc-200 transition-colors">
                      <Icon className="h-5 w-5 text-zinc-700" />
                    </div>
                    <CardTitle className="text-xl">{version.title}</CardTitle>
                  </div>
                  <CardDescription className="text-sm">
                    {version.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="mb-4 space-y-2 text-sm text-zinc-600">
                    {version.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-1 text-green-600">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={version.route}>
                    <Button className="w-full group-hover:bg-zinc-900">
                      Abrir versión
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4 text-center">
          <p className="text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">Nota:</span> Cada versión funciona de forma independiente.
            Puedes comparar las funcionalidades y decidir cuál se adapta mejor a tus necesidades.
          </p>
        </div>
      </div>
    </div>
  );
}
