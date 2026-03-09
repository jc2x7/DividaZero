<?php
// ============================================================
// DASHBOARD.PHP — Painel de Analytics do Divida Zero
// ============================================================

session_start();
require_once 'config.php';

// ---- Autenticação via sessão PHP ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['password'])) {
        if ($_POST['password'] === DASHBOARD_PASSWORD) {
            $_SESSION['auth'] = true;
        }
    }
    if (isset($_POST['logout'])) {
        session_destroy();
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    }
}
$authenticated = !empty($_SESSION['auth']);

// ============================================================
// FUNÇÕES DE CARGA E MÉTRICAS
// ============================================================

/** Lê todos os eventos de um arquivo NDJSON do dia especificado */
function load_day(string $date): array {
    $file = DATA_DIR . $date . '.json';
    if (!file_exists($file)) return [];
    $lines  = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $events = [];
    foreach ($lines as $line) {
        $ev = json_decode($line, true);
        if ($ev) $events[] = $ev;
    }
    return $events;
}

/** Carrega eventos de múltiplos dias */
function load_range(array $dates): array {
    $all = [];
    foreach ($dates as $d) {
        $all = array_merge($all, load_day($d));
    }
    return $all;
}

/** Retorna as últimas $n datas no formato Y-m-d (UTC) */
function last_n_dates(int $n): array {
    $dates = [];
    for ($i = 0; $i < $n; $i++) {
        $dates[] = gmdate('Y-m-d', strtotime("-{$i} days"));
    }
    return $dates;
}

/** Conta eventos do tipo 'app_open' */
function count_opens(array $events): int {
    return count(array_filter($events, fn($e) => $e['type'] === 'app_open'));
}

/** Conta dispositivos únicos (pelo device_id) */
function count_devices(array $events): int {
    return count(array_unique(array_column($events, 'device_id')));
}

/** Normaliza o caminho da tela (remove prefixo /(drawer) do Expo Router) */
function normalize_screen(string $screen): string {
    // Expo Router pode retornar '/(drawer)/simulator' ou '/simulator'
    $screen = preg_replace('#^\\/\(drawer\)#', '', $screen);
    return $screen ?: '/';
}

/** Contagem de screen_views por tela (normalizada), sempre mostrando as 6 telas */
function screen_counts(array $events): array {
    $all_screens = ['/', '/simulator', '/salary-calc', '/labor-laws', '/lending', '/dados'];
    $counts = array_fill_keys($all_screens, 0);

    foreach ($events as $e) {
        if ($e['type'] !== 'screen_view' || empty($e['screen'])) continue;
        $path = normalize_screen($e['screen']);
        if (array_key_exists($path, $counts)) {
            $counts[$path]++;
        }
    }

    arsort($counts);
    return $counts;
}

/** Média de sessões únicas por dispositivo por dia (30 dias) */
function avg_sessions(array $dates): float {
    $sessions = [];
    $devices  = [];
    foreach ($dates as $d) {
        foreach (load_day($d) as $e) {
            $sessions[$e['device_id'] . ':' . $e['session_id']] = 1;
            $devices[$e['device_id']] = 1;
        }
    }
    $dev_count = count($devices);
    if ($dev_count === 0 || count($dates) === 0) return 0.0;
    return round(count($sessions) / $dev_count / count($dates), 1);
}

// ============================================================
// CALCULAR MÉTRICAS (apenas se autenticado)
// ============================================================
$metrics = [];
if ($authenticated) {
    $today        = gmdate('Y-m-d');
    $week_dates   = last_n_dates(7);
    $month_prefix = gmdate('Y-m');
    $month_files  = glob(DATA_DIR . $month_prefix . '-*.json') ?: [];
    $month_dates  = array_map(fn($f) => basename($f, '.json'), $month_files);
    $last30_dates = last_n_dates(30);

    $today_ev  = load_day($today);
    $week_ev   = load_range($week_dates);
    $month_ev  = load_range($month_dates);

    $metrics = [
        'opens_today'    => count_opens($today_ev),
        'opens_week'     => count_opens($week_ev),
        'opens_month'    => count_opens($month_ev),
        'devices_today'  => count_devices($today_ev),
        'devices_week'   => count_devices($week_ev),
        'devices_month'  => count_devices($month_ev),
        'screens_month'  => screen_counts($month_ev),
        'avg_sessions'   => avg_sessions($last30_dates),
        'daily_30'       => array_map(fn($d) => [
            'date'    => $d,
            'opens'   => count_opens(load_day($d)),
            'devices' => count_devices(load_day($d)),
        ], $last30_dates),
    ];
}

// Mapeamento path → nome legível
$screen_labels = [
    '/'            => 'Dashboard',
    '/simulator'   => 'Simular Juros',
    '/salary-calc' => 'Salário Líquido',
    '/labor-laws'  => 'Rescisão & Férias',
    '/lending'     => 'Dinheiro Emprestado',
    '/dados'       => 'Meus Dados',
];
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Divida Zero — Analytics</title>
  <style>
    :root {
      --navy:    #1A1A2E;
      --dark:    #16213E;
      --red:     #E94560;
      --green:   #00B894;
      --yellow:  #FDCB6E;
      --text:    #2D3436;
      --text2:   #636E72;
      --bg:      #F0F2F5;
      --card:    #fff;
      --border:  #DFE6E9;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: var(--bg); color: var(--text); min-height: 100vh; }

    /* ---- Header ---- */
    header {
      background: var(--navy);
      color: #fff;
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header h1 { font-size: 18px; font-weight: 700; letter-spacing: 0.3px; }
    .logout-btn {
      background: var(--red);
      color: #fff;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }

    /* ---- Layout ---- */
    .container { max-width: 1080px; margin: 0 auto; padding: 28px 16px; }
    .section-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text2);
      margin-bottom: 12px;
      margin-top: 28px;
    }
    .section-label:first-of-type { margin-top: 0; }

    /* ---- Cards ---- */
    .card {
      background: var(--card);
      border-radius: 16px;
      padding: 20px 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 0; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }

    /* ---- Stat ---- */
    .stat-label  { font-size: 12px; color: var(--text2); margin-bottom: 6px; }
    .stat-value  { font-size: 32px; font-weight: 800; color: var(--navy); line-height: 1; }
    .stat-sub    { font-size: 12px; color: var(--text2); margin-top: 6px; }
    .stat-avg    { font-size: 14px; color: var(--text2); margin-top: 8px; }

    /* ---- Screen breakdown ---- */
    .screen-row {
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .screen-row:last-child { border-bottom: none; }
    .screen-top { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; }
    .screen-name { font-weight: 500; }
    .screen-count { color: var(--text2); font-size: 13px; }
    .bar-bg   { background: var(--bg); border-radius: 4px; height: 5px; }
    .bar-fill { background: var(--red); border-radius: 4px; height: 5px; transition: width 0.4s; }

    /* ---- Tabela 30 dias ---- */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      text-align: left;
      padding: 8px 12px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text2);
      border-bottom: 2px solid var(--border);
    }
    td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--bg); }
    .zero { color: var(--border); }

    /* ---- Login ---- */
    .login-wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg);
    }
    .login-card {
      background: var(--card);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      width: 320px;
    }
    .login-logo {
      width: 48px;
      height: 48px;
      background: var(--navy);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      font-size: 22px;
    }
    .login-card h2 { font-size: 20px; color: var(--navy); margin-bottom: 6px; }
    .login-card p  { font-size: 13px; color: var(--text2); margin-bottom: 24px; }
    input[type=password] {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type=password]:focus { border-color: var(--red); }
    .btn-primary {
      width: 100%;
      padding: 13px;
      background: var(--red);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 12px;
    }
    .btn-primary:hover { opacity: 0.9; }

    @media (max-width: 640px) {
      .grid-3 { grid-template-columns: 1fr; }
      .grid-2 { grid-template-columns: 1fr; }
      header { padding: 14px 16px; }
    }
  </style>
</head>
<body>

<?php if (!$authenticated): ?>
<!-- ============================================================ -->
<!-- TELA DE LOGIN -->
<!-- ============================================================ -->
<div class="login-wrap">
  <div class="login-card">
    <div class="login-logo">📊</div>
    <h2>Divida Zero</h2>
    <p>Painel de Analytics</p>
    <form method="POST">
      <input type="password" name="password" placeholder="Senha" autofocus>
      <button type="submit" class="btn-primary">Entrar</button>
    </form>
  </div>
</div>

<?php else: ?>
<!-- ============================================================ -->
<!-- DASHBOARD -->
<!-- ============================================================ -->
<header>
  <h1>📊 Divida Zero — Analytics</h1>
  <form method="POST" style="margin:0">
    <button name="logout" value="1" class="logout-btn">Sair</button>
  </form>
</header>

<div class="container">

  <!-- Aberturas do app -->
  <p class="section-label">Aberturas do App</p>
  <div class="grid-3">
    <div class="card">
      <p class="stat-label">Hoje</p>
      <p class="stat-value"><?= $metrics['opens_today'] ?></p>
      <p class="stat-sub"><?= $metrics['devices_today'] ?> dispositivo<?= $metrics['devices_today'] !== 1 ? 's' : '' ?> único<?= $metrics['devices_today'] !== 1 ? 's' : '' ?></p>
    </div>
    <div class="card">
      <p class="stat-label">Esta semana</p>
      <p class="stat-value"><?= $metrics['opens_week'] ?></p>
      <p class="stat-sub"><?= $metrics['devices_week'] ?> dispositivo<?= $metrics['devices_week'] !== 1 ? 's' : '' ?> único<?= $metrics['devices_week'] !== 1 ? 's' : '' ?></p>
    </div>
    <div class="card">
      <p class="stat-label">Este mês</p>
      <p class="stat-value"><?= $metrics['opens_month'] ?></p>
      <p class="stat-sub"><?= $metrics['devices_month'] ?> dispositivo<?= $metrics['devices_month'] !== 1 ? 's' : '' ?> único<?= $metrics['devices_month'] !== 1 ? 's' : '' ?></p>
    </div>
  </div>

  <!-- Telas + Sessões -->
  <p class="section-label">Engajamento</p>
  <div class="grid-2">

    <!-- Telas mais visitadas -->
    <div class="card">
      <p class="stat-label" style="margin-bottom:14px">Telas mais visitadas (mês)</p>
      <?php
        $total_views = array_sum($metrics['screens_month']);
        if ($total_views === 0):
      ?>
        <p class="zero" style="font-size:13px">Nenhuma visita registrada ainda.</p>
      <?php else: foreach ($metrics['screens_month'] as $path => $count):
        $pct   = round($count / $total_views * 100);
        $label = $screen_labels[$path] ?? $path;
      ?>
        <div class="screen-row">
          <div class="screen-top">
            <span class="screen-name"><?= htmlspecialchars($label) ?></span>
            <span class="screen-count"><?= number_format($count) ?> (<?= $pct ?>%)</span>
          </div>
          <div class="bar-bg"><div class="bar-fill" style="width:<?= $pct ?>%"></div></div>
        </div>
      <?php endforeach; endif; ?>
    </div>

    <!-- Sessões médias -->
    <div class="card">
      <p class="stat-label">Sessões médias por dispositivo</p>
      <p class="stat-value"><?= $metrics['avg_sessions'] ?></p>
      <p class="stat-sub">sessões/dispositivo/dia (30 dias)</p>

      <?php
        $total_sessions = 0;
        $all_devices    = [];
        foreach ($metrics['daily_30'] as $day) {
            $total_sessions += $day['opens'];
            // Nota: não temos acesso ao device_id aqui, apenas contagem
        }
      ?>
      <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border)">
        <p class="stat-label">Total aberturas (30 dias)</p>
        <p style="font-size:22px; font-weight:700; color:var(--navy)">
          <?= number_format(array_sum(array_column($metrics['daily_30'], 'opens'))) ?>
        </p>
      </div>
    </div>

  </div>

  <!-- Últimos 30 dias -->
  <p class="section-label">Últimos 30 dias</p>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Aberturas</th>
          <th>Dispositivos únicos</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($metrics['daily_30'] as $day): ?>
        <tr>
          <td><?= htmlspecialchars($day['date']) ?></td>
          <td><?= $day['opens'] > 0 ? number_format($day['opens']) : '<span class="zero">—</span>' ?></td>
          <td><?= $day['devices'] > 0 ? number_format($day['devices']) : '<span class="zero">—</span>' ?></td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <p style="font-size:11px; color:var(--text2); text-align:center; margin-top:24px">
    Dados anônimos — Atualizado em tempo real — Horário: UTC
  </p>

</div><!-- /container -->
<?php endif; ?>
</body>
</html>
