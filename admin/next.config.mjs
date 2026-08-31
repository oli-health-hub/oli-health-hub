/** @type {import('next').NextConfig} */
const nextConfig = {
  // Painel é 100% force-dynamic (dados operacionais) — o Router Cache do
  // cliente por padrão serve navegação client-side em cache por 30s mesmo
  // em rotas dynamic, gerando telas com dado desatualizado depois de uma
  // ação (ex.: filtro de /leads "sumindo" itens que acabaram de mudar de
  // status). Zerado pra sempre buscar fresco. Ver docs/HANDOFF.md §45/§49.
  experimental: {
    staleTimes: { dynamic: 0 },
  },
};
export default nextConfig;
