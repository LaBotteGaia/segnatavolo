<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Multi-restaurant: data rows carry restaurant_id (defaults to my_restaurant_id()); RLS scopes to active membership in restaurant_members; rooms/tables writable only by role master. Invites are accepted via a token server function (admin createUser) so staff cannot self-register into a restaurant. Pages live under src/routes/_authenticated; data hooks in src/lib/data.ts.
- Assigned tables are stored as uuid[] on reservations, so deleting a reservation frees its tables automatically.
- Customer reliability is derived from reservation attendance and service deadlines in Europe/Rome; only manual no-show is persisted, and normalized phone is the history key to avoid duplicate counters and name-based identity.
- Agenda layout uses the agenda-wide CSS variant for landscape screens from 768px and desktops from 1024px; keep toolbar and page visibility on the same variant to preserve orientation consistency.
