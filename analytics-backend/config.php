<?php
// ============================================================
// CONFIGURAÇÃO DO PAINEL DE ANALYTICS — DIVIDA ZERO
// ============================================================
// IMPORTANTE: Nunca commite este arquivo com credenciais reais.
// Em produção, use variáveis de ambiente ou um arquivo fora do webroot.

define('DASHBOARD_PASSWORD', '290212');

define('DATA_DIR', __DIR__ . '/data/');

// Máximo de eventos aceitos por requisição (proteção contra abuse)
define('MAX_EVENTS_PER_REQUEST', 100);
