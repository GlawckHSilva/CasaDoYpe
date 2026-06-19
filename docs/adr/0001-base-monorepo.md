# ADR 0001: Base monorepo

O Hospedex V2 nasce como monorepo com apps separados por superfície e pacotes internos para UI, tipos, feature flags e configuração.

Essa decisão reduz duplicação, mantém os contratos compartilhados explícitos e preserva espaço para backend Python, workers e integrações evoluírem sem acoplar as interfaces.
