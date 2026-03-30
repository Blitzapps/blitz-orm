import { expect, it } from 'vitest';
import { createTest } from '../../helpers/createTest';

export const testCircularRefsMutation = createTest('Mutation: Circular References', (ctx) => {
  // --- Circular reference via subType ---
  // Widget extends WidgetBase. WidgetBase has a linkField `panels` that creates Panels.
  // Panel's `widget` role references WidgetBase (the base type), with subTypes including Widget.
  // Widget (via WidgetBase) has a `mainPanel` role referencing Panel.
  // When creating a Widget with panels AND mainPanel pointing to one of those panels,
  // we get: Widget → Panel (via mainPanel) and Panel → Widget (via widget/WidgetBase subType).

  it('circ1[create, circular, subType] Create Widget with panels and mainPanel referencing a created panel', async () => {
    // This mutation creates a circular reference through subTypes:
    // Widget.mainPanel → Panel, and Panel.widget → WidgetBase (subType: Widget)
    const res = await ctx.mutate(
      {
        $entity: 'Space',
        $id: 'space-1',
        $op: 'update',
        widgets: [
          {
            $thing: 'Widget',
            $op: 'create',
            $tempId: '_:w1',
            name: 'CircularWidget',
            mainPanel: { $op: 'link', $tempId: '_:p1' },
            panels: [{ $tempId: '_:p1', type: 'SCOPE' }, { type: 'VALUE' }],
          },
        ],
      },
      { noMetadata: true },
    );

    expect(res).toBeDefined();

    // Verify the widget was created with the correct structure
    const widgetId = (res as any)?.find?.((r: any) => r.$thing === 'Widget')?.$id;
    if (!widgetId) {
      // If response format is different, just query to verify
    }

    // Query to verify the widget and panels exist with correct references
    const queryRes = await ctx.query(
      {
        $entity: 'Space',
        $id: 'space-1',
        $fields: [
          {
            $path: 'widgets',
            $fields: ['id', 'name', { $path: 'mainPanel' }, { $path: 'panels', $fields: ['id', 'type'] }],
          },
        ],
      },
      { noMetadata: true },
    );

    expect(queryRes).toBeDefined();
    const widgets = (queryRes as any)?.widgets;
    expect(widgets).toBeDefined();

    const widget = widgets?.find((w: any) => w.name === 'CircularWidget');
    expect(widget).toBeDefined();
    expect(widget.panels).toHaveLength(2);
    expect(widget.mainPanel).toBeDefined();

    // mainPanel is returned as an object with id, or as a string id
    const mainPanelId = typeof widget.mainPanel === 'string' ? widget.mainPanel : widget.mainPanel.id;
    const panelIds = widget.panels.map((p: any) => p.id);
    expect(panelIds).toContain(mainPanelId);

    // The SCOPE panel should be the mainPanel
    const scopePanel = widget.panels.find((p: any) => p.type === 'SCOPE');
    expect(scopePanel).toBeDefined();
    expect(scopePanel.id).toBe(mainPanelId);

    // Cleanup
    await ctx.mutate(
      widget.panels.map((p: any) => ({
        $relation: 'Panel',
        $id: p.id,
        $op: 'delete',
      })),
      { noMetadata: true },
    );
    await ctx.mutate({ $relation: 'Widget', $id: widget.id, $op: 'delete' }, { noMetadata: true });
  });

  it('circ2[create, circular, direct] Create two panels that reference each other via Widget linkField', async () => {
    // First create a space for this test
    const spaceId = 'space-1';

    // Create a WidgetBase (no subType involved) with mainPanel referencing one of its panels
    // WidgetBase.mainPanel → Panel, and Panel.widget → WidgetBase (direct match, no subType)
    const res = await ctx.mutate(
      {
        $entity: 'Space',
        $id: spaceId,
        $op: 'update',
        widgetBases: [
          {
            $thing: 'WidgetBase',
            $op: 'create',
            $tempId: '_:wb1',
            mainPanel: { $op: 'link', $tempId: '_:p1' },
            panels: [{ $tempId: '_:p1', type: 'MAIN' }],
          },
        ],
      },
      { noMetadata: true },
    );

    expect(res).toBeDefined();

    // Query to verify
    const queryRes = await ctx.query(
      {
        $entity: 'Space',
        $id: spaceId,
        $fields: [
          {
            $path: 'widgetBases',
            $fields: ['id', { $path: 'mainPanel' }, { $path: 'panels', $fields: ['id', 'type'] }],
          },
        ],
      },
      { noMetadata: true },
    );

    const widgets = (queryRes as any)?.widgetBases;
    const wb = widgets?.find((w: any) => w.panels?.some((p: any) => p.type === 'MAIN'));
    expect(wb).toBeDefined();
    expect(wb.panels).toHaveLength(1);
    const mainPanelId = typeof wb.mainPanel === 'string' ? wb.mainPanel : wb.mainPanel.id;
    expect(mainPanelId).toBe(wb.panels[0].id);

    // Cleanup
    await ctx.mutate({ $relation: 'Panel', $id: wb.panels[0].id, $op: 'delete' }, { noMetadata: true });
    await ctx.mutate({ $relation: 'WidgetBase', $id: wb.id, $op: 'delete' }, { noMetadata: true });
  });

  it('circ3[create, circular, subType, multiple] Create Widget with multiple panels and mainPanel', async () => {
    // Create a Widget with 3 panels, where mainPanel references the second panel
    const res = await ctx.mutate(
      {
        $entity: 'Space',
        $id: 'space-1',
        $op: 'update',
        widgets: [
          {
            $thing: 'Widget',
            $op: 'create',
            $tempId: '_:w1',
            name: 'MultiPanelWidget',
            mainPanel: { $op: 'link', $tempId: '_:p2' },
            panels: [
              { $tempId: '_:p1', type: 'HEADER' },
              { $tempId: '_:p2', type: 'BODY' },
              { $tempId: '_:p3', type: 'FOOTER' },
            ],
          },
        ],
      },
      { noMetadata: true },
    );

    expect(res).toBeDefined();

    // Query to verify
    const queryRes = await ctx.query(
      {
        $entity: 'Space',
        $id: 'space-1',
        $fields: [
          {
            $path: 'widgets',
            $fields: ['id', 'name', { $path: 'mainPanel' }, { $path: 'panels', $fields: ['id', 'type'] }],
          },
        ],
      },
      { noMetadata: true },
    );

    const widgets = (queryRes as any)?.widgets;
    const widget = widgets?.find((w: any) => w.name === 'MultiPanelWidget');
    expect(widget).toBeDefined();
    expect(widget.panels).toHaveLength(3);

    // mainPanel should be the BODY panel
    const bodyPanel = widget.panels.find((p: any) => p.type === 'BODY');
    expect(bodyPanel).toBeDefined();
    const mainPanelId = typeof widget.mainPanel === 'string' ? widget.mainPanel : widget.mainPanel.id;
    expect(mainPanelId).toBe(bodyPanel.id);

    // Cleanup
    await ctx.mutate(
      widget.panels.map((p: any) => ({
        $relation: 'Panel',
        $id: p.id,
        $op: 'delete',
      })),
      { noMetadata: true },
    );
    await ctx.mutate({ $relation: 'Widget', $id: widget.id, $op: 'delete' }, { noMetadata: true });
  });
});
