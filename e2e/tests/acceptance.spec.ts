import { expect, type Page, test } from '@playwright/test';

/**
 * The challenge's acceptance criteria, end to end in a real browser against
 * the running stack, with either product source (fakestore or fixture).
 * Expected values come from the API, so the suite doesn't hard-code data.
 */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

interface ApiProduct {
  id: string;
  title: string;
}

/** Fail the test on any browser console error or uncaught exception (e.g. a CSP violation). */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('Challenge acceptance criteria', () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = watchForErrors(page);
  });

  test.afterEach(() => {
    expect(errors, 'browser console errors').toEqual([]);
  });

  test('Home: the 5 products chosen as "top rated" are shown, in order', async ({
    page,
    request,
  }) => {
    const featured = (await (await request.get('/api/v1/featured-products')).json()) as {
      items: ApiProduct[];
    };
    expect(featured.items).toHaveLength(5);

    await page.goto('/');
    const tiles = page.getByRole('list', { name: 'Top rated products' }).getByRole('heading');
    await expect(tiles).toHaveText(featured.items.map((product) => product.title));

    // Images come through our API proxy and actually render (constraint 2, CSP).
    const firstImage = page
      .getByRole('list', { name: 'Top rated products' })
      .getByRole('img')
      .first();
    await expect(firstImage).toHaveAttribute('src', /^\/api\/v1\/products\/.+\/image$/);
    await expect
      .poll(() => firstImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  });

  test('Category: a category link shows top rated, then additional products', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Categories' })
      .getByRole('link', { name: 'Electronics' })
      .click();

    await expect(page.getByRole('heading', { level: 1, name: 'Electronics' })).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Top rated in Electronics' }).getByRole('listitem'),
    ).toHaveCount(3);
    await expect(
      page.getByRole('list', { name: 'More in Electronics' }).getByRole('listitem'),
    ).not.toHaveCount(0);
  });

  test('Search: only products matching the term are shown', async ({ page, request }) => {
    const expected = (await (await request.get('/api/v1/products?q=slim%20fit')).json()) as {
      items: ApiProduct[];
    };

    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search products' }).fill('slim fit');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Results for “slim fit”');
    await expect(
      page.getByRole('list', { name: 'Search results' }).getByRole('heading'),
    ).toHaveText(expected.items.map((product) => product.title));
    for (const product of expected.items) {
      expect(product.title.toLowerCase() + JSON.stringify(product).toLowerCase()).toContain(
        'slim fit',
      );
    }
  });

  test('Search: no matches shows a message and ways back', async ({ page }) => {
    await page.goto('/search?q=zzzzqq');
    await expect(page.getByText('No products match “zzzzqq”.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the home page' })).toBeVisible();
  });

  test('Product: clicking a tile shows the product details page', async ({ page }) => {
    await page.goto('/');
    const tile = page.getByRole('list', { name: 'Top rated products' }).getByRole('link').first();
    const title = (await tile.getByRole('heading').textContent()) ?? '';
    await tile.click();

    await expect(page).toHaveURL(/\/product\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByText(/^\$\d/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enquire' })).toBeVisible();
    await expect(page).toHaveTitle(`${title} | Catalogue`);
  });

  test('Enquiry: the sales inbox receives an email and the customer sees "Thank you"', async ({
    page,
    request,
  }) => {
    await request.delete(`${MAILPIT}/api/v1/messages`);
    const product = (await (await request.get('/api/v1/products/1')).json()) as ApiProduct;

    await page.goto('/product/1');
    await page.getByRole('button', { name: 'Enquire' }).click();
    await page.getByRole('textbox', { name: 'Name (required)' }).fill('Jane Doe');
    await page.getByRole('textbox', { name: 'Email (required)' }).fill('jane@example.com');
    await page.getByRole('textbox', { name: 'Message' }).fill('Is this available in blue?');
    await page.getByRole('button', { name: 'Send enquiry' }).click();

    await expect(page.getByRole('status')).toHaveText(
      `Thank you, Jane Doe. We've received your enquiry about ${product.title} and will reply to jane@example.com.`,
    );

    // The email in the sales inbox (Mailpit).
    await expect
      .poll(async () => {
        const inbox = (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()) as {
          messages_count: number;
        };
        return inbox.messages_count;
      })
      .toBe(1);
    const inbox = (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()) as {
      messages: { ID: string }[];
    };
    const email = (await (
      await request.get(`${MAILPIT}/api/v1/message/${inbox.messages[0]?.ID}`)
    ).json()) as {
      To: { Address: string }[];
      ReplyTo: { Address: string }[];
      Subject: string;
      Text: string;
    };
    expect(email.To.map((address) => address.Address)).toEqual(['sales@example.com']);
    expect(email.ReplyTo.map((address) => address.Address)).toEqual(['jane@example.com']);
    expect(email.Subject).toBe(`New enquiry: ${product.title} (ID 1)`);
    expect(email.Text).toContain('Is this available in blue?');
    expect(email.Text).toContain('Link:    http://localhost:8080/product/1');
  });

  test('Enquiry: missing details are flagged and nothing is sent', async ({ page, request }) => {
    await request.delete(`${MAILPIT}/api/v1/messages`);

    await page.goto('/product/1');
    await page.getByRole('button', { name: 'Enquire' }).click();
    await page.getByRole('button', { name: 'Send enquiry' }).click();

    await expect(page.getByText('Please enter your name.')).toBeVisible();
    await expect(page.getByText('Please enter your email address.')).toBeVisible();
    const inbox = (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()) as {
      messages_count: number;
    };
    expect(inbox.messages_count).toBe(0);
  });

  test('Unknown product and unknown page show friendly not-found views', async ({ page }) => {
    await page.goto('/product/does-not-exist');
    await expect(
      page.getByRole('heading', { name: "We couldn't find that product." }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enquire' })).toHaveCount(0);

    await page.goto('/no/such/page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();

    // The API answering 404 for the unknown product is the expected behaviour;
    // Chrome logs every 404 response, so allow exactly that one here.
    errors = errors.filter((error) => !/status of 404/.test(error));
  });
});
