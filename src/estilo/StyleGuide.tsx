import AccountIcon from '@material-symbols/svg-400/rounded/account_balance_wallet.svg?react';
import CheckCircleIcon from '@material-symbols/svg-400/rounded/check_circle.svg?react';
import ChevronLeftIcon from '@material-symbols/svg-400/rounded/chevron_left.svg?react';
import ChevronRightIcon from '@material-symbols/svg-400/rounded/chevron_right.svg?react';
import CloseIcon from '@material-symbols/svg-400/rounded/close.svg?react';
import DarkModeIcon from '@material-symbols/svg-400/rounded/dark_mode.svg?react';
import DeleteIcon from '@material-symbols/svg-400/rounded/delete.svg?react';
import EditIcon from '@material-symbols/svg-400/rounded/edit.svg?react';
import ErrorIcon from '@material-symbols/svg-400/rounded/error.svg?react';
import HomeIcon from '@material-symbols/svg-400/rounded/home.svg?react';
import InfoIcon from '@material-symbols/svg-400/rounded/info.svg?react';
import LightModeIcon from '@material-symbols/svg-400/rounded/light_mode.svg?react';
import MoreIcon from '@material-symbols/svg-400/rounded/more_vert.svg?react';
import ReceiptIcon from '@material-symbols/svg-400/rounded/receipt_long.svg?react';
import SavingsIcon from '@material-symbols/svg-400/rounded/savings.svg?react';
import SettingsIcon from '@material-symbols/svg-400/rounded/settings.svg?react';
import TrendingUpIcon from '@material-symbols/svg-400/rounded/trending_up.svg?react';
import UploadIcon from '@material-symbols/svg-400/rounded/upload_file.svg?react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import logoDark from '@/brand/logo-dark.svg';
import logoLight from '@/brand/logo-light.svg';
import logoOnTop from '@/brand/logo-on-top.svg';
import { contrast } from '@/design/contrast';
import { navigate } from '@/design/motion';
import { THEMES, TOKEN_NAMES, tokens, type Theme, type TokenName } from '@/design/tokens';
import { formatDate } from '@/format/format';
import { LanguageSelect, ThemeSelect } from '@/preferences';
import { Amount } from '@/ui/amount';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardTitle } from '@/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
import { Icon, type IconComponent } from '@/ui/icon';
import { Input } from '@/ui/input';
import { Progress } from '@/ui/progress';
import { Select } from '@/ui/select';
import { Switch } from '@/ui/switch';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { useToast } from '@/ui/toast';
import { Tooltip } from '@/ui/tooltip';
import { TopBar, topBarActionClass } from '@/ui/top-bar';

const BASE = import.meta.env.BASE_URL;

const ICONS: [name: string, icon: IconComponent][] = [
  ['home', HomeIcon],
  ['account_balance_wallet', AccountIcon],
  ['receipt_long', ReceiptIcon],
  ['upload_file', UploadIcon],
  ['savings', SavingsIcon],
  ['trending_up', TrendingUpIcon],
  ['settings', SettingsIcon],
  ['more_vert', MoreIcon],
  ['edit', EditIcon],
  ['delete', DeleteIcon],
  ['info', InfoIcon],
  ['check_circle', CheckCircleIcon],
  ['error', ErrorIcon],
  ['close', CloseIcon],
  ['chevron_left', ChevronLeftIcon],
  ['chevron_right', ChevronRightIcon],
  ['light_mode', LightModeIcon],
  ['dark_mode', DarkModeIcon],
];

const TYPE_SCALE = [
  ['text-xs', 12],
  ['text-sm', 14],
  ['text-base', 16],
  ['text-lg', 20],
  ['text-xl', 24],
  ['text-2xl', 32],
  ['text-3xl', 40],
] as const;

// Each token is measured against bg and surface, except on-* against their own background.
const PAIRS: Partial<Record<TokenName, TokenName>> = { 'on-top': 'top', 'on-brand': 'brand' };

export default function StyleGuide() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = `Míre · ${t('styleguide.title')}`;
  }, [t, i18n.resolvedLanguage]);

  return (
    <>
      <TopBar title={t('styleguide.title')} actions={<TopBarActions />} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <p className="text-muted">{t('styleguide.intro')}</p>
        <Card aria-labelledby="sg-preferences">
          <CardTitle id="sg-preferences">{t('home.preferences')}</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <LanguageSelect />
            <ThemeSelect />
          </div>
        </Card>
        <Colours />
        <Typography />
        <Logos />
        <Icons />
        <Components />
        <Amounts />
        <MotionDemo />
      </main>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card aria-labelledby={id}>
      <CardTitle id={id}>{title}</CardTitle>
      <div className="flex flex-col gap-6">{children}</div>
    </Card>
  );
}

function Subsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function TopBarActions() {
  const { t } = useTranslation();
  return (
    <>
      <Tooltip content={t('styleguide.overlays.tooltip')}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('styleguide.overlays.info')}
          className={topBarActionClass}
        >
          <Icon icon={InfoIcon} />
        </Button>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('ui.moreOptions')}
            className={topBarActionClass}
          >
            <Icon icon={MoreIcon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            <Icon icon={EditIcon} size={20} className="text-muted" />
            {t('styleguide.overlays.edit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-negative">
            <Icon icon={DeleteIcon} size={20} />
            {t('styleguide.overlays.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function Colours() {
  const { t, i18n } = useTranslation();
  const ratio = new Intl.NumberFormat(i18n.resolvedLanguage, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const cell = (theme: Theme, name: TokenName) => {
    const value = tokens[theme][name];
    const against = PAIRS[name] ? [PAIRS[name]] : (['bg', 'surface'] as const);
    return (
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-6 shrink-0 rounded-[6px] border border-line"
          style={{ backgroundColor: value }}
        />
        <span>
          <code className="block">{value}</code>
          <span className="block text-xs text-muted tabular-nums">
            {against
              .map((bg) => `${bg} ${ratio.format(contrast(value, tokens[theme][bg]))}:1`)
              .join(' · ')}
          </span>
        </span>
      </div>
    );
  };
  return (
    <Section id="sg-colours" title={t('styleguide.colours.title')}>
      <Table>
        <TableCaption>{t('styleguide.colours.caption')}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{t('styleguide.colours.token')}</TableHead>
            {THEMES.map((theme) => (
              <TableHead key={theme}>{t(`theme.${theme}`)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {TOKEN_NAMES.map((name) => (
            <TableRow key={name}>
              <TableCell>
                <code>{name}</code>
              </TableCell>
              {THEMES.map((theme) => (
                <TableCell key={theme}>{cell(theme, name)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

function Typography() {
  const { t } = useTranslation();
  return (
    <Section id="sg-type" title={t('styleguide.type.title')}>
      <ul className="flex flex-col gap-3">
        {TYPE_SCALE.map(([className, px]) => (
          <li key={className} className="flex min-w-0 items-baseline gap-4">
            <span className="w-12 shrink-0 text-xs text-muted tabular-nums">{px} px</span>
            <span className={`${className} min-w-0 break-words`}>
              {t('styleguide.type.sample')}
            </span>
          </li>
        ))}
      </ul>
      <ul className="grid gap-1 sm:grid-cols-2">
        <li className="font-normal">400 · {t('styleguide.type.regular')}</li>
        <li className="font-medium">500 · {t('styleguide.type.medium')}</li>
        <li className="font-semibold">600 · {t('styleguide.type.semibold')}</li>
        <li className="font-bold">700 · {t('styleguide.type.bold')}</li>
      </ul>
      <p className="text-muted">{t('styleguide.type.numbers')}</p>
    </Section>
  );
}

function Logos() {
  const { t } = useTranslation();
  const tile = (label: string, background: string, content: ReactNode) => (
    <figure className="flex flex-col gap-2">
      <div
        className="flex h-28 items-center justify-center rounded-card border border-line"
        style={{ backgroundColor: background }}
      >
        {content}
      </div>
      <figcaption className="text-sm text-muted">{label}</figcaption>
    </figure>
  );
  return (
    <Section id="sg-logo" title={t('styleguide.logo.title')}>
      <div className="grid gap-4 sm:grid-cols-3">
        {tile(
          t('styleguide.logo.light'),
          tokens.light.bg,
          <img src={logoLight} alt="Míre" className="h-8 w-auto" />,
        )}
        {tile(
          t('styleguide.logo.dark'),
          tokens.dark.bg,
          <img src={logoDark} alt="Míre" className="h-8 w-auto" />,
        )}
        {tile(
          t('styleguide.logo.onTop'),
          tokens.dark.surface,
          <img src={logoOnTop} alt="Míre" className="h-6 w-auto" />,
        )}
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <figure className="flex flex-col gap-2">
          <img
            src={`${BASE}icons/icon-192.png`}
            alt={t('styleguide.logo.appIcon')}
            width={96}
            height={96}
            className="rounded-card"
          />
          <figcaption className="text-sm text-muted">{t('styleguide.logo.appIcon')}</figcaption>
        </figure>
        <figure className="flex flex-col gap-2">
          <img
            src={`${BASE}icons/icon-maskable-512.png`}
            alt={t('styleguide.logo.maskable')}
            width={96}
            height={96}
            className="rounded-full"
          />
          <figcaption className="text-sm text-muted">{t('styleguide.logo.maskable')}</figcaption>
        </figure>
        <figure className="flex flex-col gap-2">
          <img
            src={`${BASE}favicon.svg`}
            alt={t('styleguide.logo.favicon')}
            width={32}
            height={32}
          />
          <figcaption className="text-sm text-muted">{t('styleguide.logo.favicon')}</figcaption>
        </figure>
      </div>
    </Section>
  );
}

function Icons() {
  const { t } = useTranslation();
  return (
    <Section id="sg-icons" title={t('styleguide.icons.title')}>
      <p className="text-muted">{t('styleguide.icons.description')}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ICONS.map(([name, icon]) => (
          <li key={name} className="flex min-w-0 items-center gap-2">
            <Icon icon={icon} />
            <Icon icon={icon} size={20} className="text-muted" />
            <code className="min-w-0 truncate text-xs">{name}</code>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Components() {
  const { t } = useTranslation();
  const toast = useToast();
  const inputId = useId();
  const disabledInputId = useId();
  const selectId = useId();
  const [syncOn, setSyncOn] = useState(true);
  const [hideAmounts, setHideAmounts] = useState(false);
  const rows = [
    ['2026-10-01', t('styleguide.content.salary'), 2350, 'income'],
    ['2026-10-03', t('styleguide.content.groceries'), -84.2, 'expense'],
    ['2026-10-05', t('styleguide.content.toSavings'), 500, 'transfer'],
  ] as const;

  return (
    <Section id="sg-components" title={t('styleguide.components.title')}>
      <Subsection title={t('styleguide.buttons.title')}>
        <div className="flex flex-wrap gap-2">
          <Button>{t('styleguide.buttons.primary')}</Button>
          <Button variant="secondary">{t('styleguide.buttons.secondary')}</Button>
          <Button variant="ghost">{t('styleguide.buttons.ghost')}</Button>
          <Button size="compact">{t('styleguide.buttons.compact')}</Button>
          <Button disabled>{t('styleguide.buttons.disabled')}</Button>
          <Button variant="secondary" disabled>
            {t('styleguide.buttons.disabled')}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t('styleguide.overlays.edit')}>
            <Icon icon={EditIcon} />
          </Button>
        </div>
      </Subsection>

      <Subsection title={t('styleguide.fields.title')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={inputId} className="text-sm font-medium text-muted">
              {t('styleguide.fields.concept')}
            </label>
            <Input id={inputId} placeholder={t('styleguide.fields.placeholder')} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={disabledInputId} className="text-sm font-medium text-muted">
              {t('styleguide.fields.disabled')}
            </label>
            <Input id={disabledInputId} disabled defaultValue={t('styleguide.fields.rent')} />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={selectId} className="text-sm font-medium text-muted">
              {t('styleguide.fields.accountType')}
            </label>
            <Select id={selectId} defaultValue="current">
              <option value="current">{t('styleguide.fields.current')}</option>
              <option value="savings">{t('styleguide.fields.savings')}</option>
              <option value="investment">{t('styleguide.fields.investment')}</option>
            </Select>
          </div>
        </div>
      </Subsection>

      <Subsection title={t('styleguide.switches.title')}>
        <div className="flex flex-col gap-4">
          <SwitchRow label={t('styleguide.switches.sync')} checked={syncOn} onChange={setSyncOn} />
          <SwitchRow
            label={t('styleguide.switches.hide')}
            checked={hideAmounts}
            onChange={setHideAmounts}
          />
          <SwitchRow label={t('styleguide.switches.disabled')} checked={false} disabled />
        </div>
      </Subsection>

      <Subsection title={t('styleguide.tabs.title')}>
        <Tabs defaultValue="month">
          <TabsList aria-label={t('styleguide.tabs.title')}>
            <TabsTrigger value="month">{t('styleguide.tabs.month')}</TabsTrigger>
            <TabsTrigger value="year">{t('styleguide.tabs.year')}</TabsTrigger>
            <TabsTrigger value="all">{t('styleguide.tabs.all')}</TabsTrigger>
          </TabsList>
          <TabsContent value="month">{t('styleguide.tabs.monthContent')}</TabsContent>
          <TabsContent value="year">{t('styleguide.tabs.yearContent')}</TabsContent>
          <TabsContent value="all">{t('styleguide.tabs.allContent')}</TabsContent>
        </Tabs>
      </Subsection>

      <Subsection title={t('styleguide.overlays.title')}>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">{t('styleguide.overlays.openDialog')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>{t('styleguide.overlays.dialogTitle')}</DialogTitle>
              <DialogDescription>{t('styleguide.overlays.dialogBody')}</DialogDescription>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">{t('styleguide.overlays.cancel')}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>{t('styleguide.overlays.confirm')}</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                kind: 'positive',
                title: t('styleguide.overlays.toastPositiveTitle'),
                description: t('styleguide.overlays.toastPositiveBody'),
              })
            }
          >
            {t('styleguide.overlays.showPositive')}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                kind: 'negative',
                title: t('styleguide.overlays.toastNegativeTitle'),
                description: t('styleguide.overlays.toastNegativeBody'),
              })
            }
          >
            {t('styleguide.overlays.showNegative')}
          </Button>
        </div>
        <p className="text-sm text-muted">{t('styleguide.overlays.topBarHint')}</p>
      </Subsection>

      <Subsection title={t('styleguide.content.title')}>
        <div className="rounded-card border border-line bg-bg p-4">
          <p className="font-semibold">{t('styleguide.content.card')}</p>
          <p className="text-muted">{t('styleguide.content.cardBody')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{t('styleguide.content.neutral')}</Badge>
          <Badge variant="positive">{t('styleguide.amounts.income')}</Badge>
          <Badge variant="negative">{t('styleguide.amounts.expense')}</Badge>
          <Badge variant="gold">{t('styleguide.content.goal')}</Badge>
        </div>
        <Progress value={68} label={t('styleguide.content.goal')} />
        <Table>
          <TableCaption>{t('styleguide.content.tableCaption')}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('styleguide.content.date')}</TableHead>
              <TableHead>{t('styleguide.content.concept')}</TableHead>
              <TableHead className="text-right">{t('styleguide.content.amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([date, concept, value, kind]) => (
              <TableRow key={date}>
                <TableCell className="tabular-nums">{formatDate(date)}</TableCell>
                <TableCell>{concept}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Amount value={value} kind={kind} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Subsection>
    </Section>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className={disabled ? 'opacity-50' : undefined}>
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function Amounts() {
  const { t } = useTranslation();
  const examples = [
    [t('styleguide.amounts.income'), 2350, 'income'],
    [t('styleguide.amounts.expense'), -84.2, 'expense'],
    [t('styleguide.amounts.transfer'), 500, 'transfer'],
    [t('styleguide.amounts.balance'), 48215.3, 'balance'],
    [t('styleguide.amounts.negativeBalance'), -1000, 'balance'],
  ] as const;
  return (
    <Section id="sg-amounts" title={t('styleguide.amounts.title')}>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
        {examples.map(([label, value, kind]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right text-lg font-semibold">
              <Amount value={value} kind={kind} />
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function MotionDemo() {
  const { t } = useTranslation();
  const [panel, setPanel] = useState(1);
  return (
    <Section id="sg-motion" title={t('styleguide.motion.title')}>
      <p className="text-muted">{t('styleguide.motion.description')}</p>
      <div
        data-testid="motion-panel"
        aria-live="polite"
        className="flex h-28 items-center justify-center rounded-card border border-line bg-bg text-lg font-semibold"
      >
        {t('styleguide.motion.panel', { n: panel })}
      </div>
      <div className="flex justify-between gap-2">
        <Button
          variant="secondary"
          disabled={panel === 1}
          onClick={() => navigate('back', () => setPanel(1))}
        >
          <Icon icon={ChevronLeftIcon} size={20} />
          {t('styleguide.motion.previous')}
        </Button>
        <Button disabled={panel === 2} onClick={() => navigate('forward', () => setPanel(2))}>
          {t('styleguide.motion.next')}
          <Icon icon={ChevronRightIcon} size={20} />
        </Button>
      </div>
    </Section>
  );
}
