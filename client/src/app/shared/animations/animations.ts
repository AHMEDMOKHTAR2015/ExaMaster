import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger,
  state,
  keyframes,
  group
} from '@angular/animations';

/**
 * Shared animation definitions following DRY principle
 * Reusable across all components
 */

// Fade in animation
export const fadeIn = trigger('fadeIn', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('300ms ease-out', style({ opacity: 1 }))
  ]),
  transition(':leave', [
    animate('200ms ease-in', style({ opacity: 0 }))
  ])
]);

// Slide in from bottom
export const slideInUp = trigger('slideInUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(1.875rem)' }),
    animate('400ms cubic-bezier(0.35, 0, 0.25, 1)', 
      style({ opacity: 1, transform: 'translateY(0)' }))
  ]),
  transition(':leave', [
    animate('300ms cubic-bezier(0.35, 0, 0.25, 1)', 
      style({ opacity: 0, transform: 'translateY(-1.25rem)' }))
  ])
]);

// Slide in from left
export const slideInLeft = trigger('slideInLeft', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(-1.875rem)' }),
    animate('400ms cubic-bezier(0.35, 0, 0.25, 1)', 
      style({ opacity: 1, transform: 'translateX(0)' }))
  ])
]);

// Slide in from right
export const slideInRight = trigger('slideInRight', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(1.875rem)' }),
    animate('400ms cubic-bezier(0.35, 0, 0.25, 1)', 
      style({ opacity: 1, transform: 'translateX(0)' }))
  ])
]);

// Scale in animation
export const scaleIn = trigger('scaleIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.8)' }),
    animate('350ms cubic-bezier(0.35, 0, 0.25, 1)', 
      style({ opacity: 1, transform: 'scale(1)' }))
  ]),
  transition(':leave', [
    animate('250ms cubic-bezier(0.35, 0, 0.25, 1)', 
      style({ opacity: 0, transform: 'scale(0.8)' }))
  ])
]);

// Stagger list animation - for quiz cards
export const staggerList = trigger('staggerList', [
  transition('* => *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(1.25rem)' }),
      stagger('80ms', [
        animate('400ms cubic-bezier(0.35, 0, 0.25, 1)', 
          style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ], { optional: true })
  ])
]);

// Card hover animation
export const cardHover = trigger('cardHover', [
  state('normal', style({
    transform: 'translateY(0)',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  })),
  state('hovered', style({
    transform: 'translateY(-0.5rem)',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  })),
  transition('normal <=> hovered', animate('200ms ease-out'))
]);

// Pulse animation for icons/buttons
export const pulse = trigger('pulse', [
  transition('* => *', [
    animate('600ms', keyframes([
      style({ transform: 'scale(1)', offset: 0 }),
      style({ transform: 'scale(1.1)', offset: 0.5 }),
      style({ transform: 'scale(1)', offset: 1 })
    ]))
  ])
]);

// Shake animation for errors
export const shake = trigger('shake', [
  transition('* => *', [
    animate('400ms', keyframes([
      style({ transform: 'translateX(0)', offset: 0 }),
      style({ transform: 'translateX(-0.625rem)', offset: 0.2 }),
      style({ transform: 'translateX(0.625rem)', offset: 0.4 }),
      style({ transform: 'translateX(-0.625rem)', offset: 0.6 }),
      style({ transform: 'translateX(0.625rem)', offset: 0.8 }),
      style({ transform: 'translateX(0)', offset: 1 })
    ]))
  ])
]);

// Route transition animation — slide from left to right on navigation.
// Only the leaving page is taken out of flow (absolute overlay); the entering
// page stays in normal flow so the container keeps its height — no collapse /
// padding-strip jump when the animation finishes.
export const routeAnimation = trigger('routeAnimation', [
  transition('* <=> *', [
    style({ position: 'relative', overflow: 'hidden' }),
    query(':leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%'
      })
    ], { optional: true }),
    // Incoming page starts off-screen to the left (kept in normal flow)
    query(':enter', [
      style({ opacity: 0, transform: 'translateX(-100%)' })
    ], { optional: true }),
    group([
      // Outgoing page slides out toward the right
      query(':leave', [
        animate('620ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 0, transform: 'translateX(100%)' }))
      ], { optional: true }),
      // Incoming page slides in from the left into place
      query(':enter', [
        animate('620ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ], { optional: true })
    ])
  ])
]);

// Button click animation
export const buttonClick = trigger('buttonClick', [
  transition('* => clicked', [
    animate('150ms', keyframes([
      style({ transform: 'scale(1)', offset: 0 }),
      style({ transform: 'scale(0.95)', offset: 0.5 }),
      style({ transform: 'scale(1)', offset: 1 })
    ]))
  ])
]);

// Expand collapse animation
export const expandCollapse = trigger('expandCollapse', [
  state('collapsed', style({
    height: '0',
    overflow: 'hidden',
    opacity: 0
  })),
  state('expanded', style({
    height: '*',
    overflow: 'visible',
    opacity: 1
  })),
  transition('collapsed <=> expanded', animate('300ms cubic-bezier(0.35, 0, 0.25, 1)'))
]);

// Swap one view for another in the same place (the login card's sign-in and
// request-access forms): the old one fades out, then the new one fades in.
// The entering view is kept out of layout until the leaving one is gone, so
// the container never holds both at once and its height never doubles
// mid-swap. The views are flex columns, which is the display restored. The
// first render does not animate: the card has its own entrance.
export const crossFade = trigger('crossFade', [
  transition((from, to) => from !== 'void' && to !== 'void' && from !== to, [
    query(':enter', style({ display: 'none' }), { optional: true }),
    query(':leave', animate('180ms ease-in', style({ opacity: 0, transform: 'translateY(-0.5rem)' })), { optional: true }),
    query(':leave', style({ display: 'none' }), { optional: true }),
    query(':enter', [
      style({ display: 'flex', opacity: 0, transform: 'translateY(0.5rem)' }),
      animate('260ms ease-out', style({ opacity: 1, transform: 'none' }))
    ], { optional: true })
  ])
]);
