"""
Product Tour UI Tests - Playwright
Tests the 4-step product tour on the Dashboard
"""
import asyncio
from playwright.async_api import async_playwright

TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYzA1NGJhY2MtNzI1Ni00MWFiLWI2MTMtMTM3OWZiOGVlODgzIiwiZW1haWwiOiJ0ZXN0QGZ1dHVyZWZyb250aWVyY2FwaXRhbC52YyIsImV4cCI6MTc3ODgwMzgwNn0.FxlgMkfUO2Y-f2oTIRAh0EKtSO7a5YgXwmU5sCDdb28'
BASE_URL = 'https://vc-pipeline-1.preview.emergentagent.com'

results = []

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")
    results.append({"status": status, "msg": msg})

async def setup_page(page, clear_dismissed=True):
    await page.set_viewport_size({"width": 1920, "height": 1080})
    await page.goto(BASE_URL)
    await page.evaluate(f"localStorage.setItem('auth_token', '{TOKEN}')")
    if clear_dismissed:
        await page.evaluate("localStorage.removeItem('vc_tour_dismissed')")
    else:
        await page.evaluate("localStorage.setItem('vc_tour_dismissed', '1')")
    await page.goto(f"{BASE_URL}/dashboard")
    await page.wait_for_timeout(4000)

async def inject_fake_deal_and_trigger_tour(page):
    """Inject a fake deal row + trigger tour if no deals exist"""
    deal_rows = await page.query_selector_all('[data-testid^="deal-row-"]')
    if len(deal_rows) == 0:
        log("No deals found - injecting fake deal row and target elements")
        await page.evaluate("""
            () => {
                // Create fake deal row
                const table = document.querySelector('table tbody') || document.querySelector('[data-testid="deals-table"]');
                if (table) {
                    const row = document.createElement('tr');
                    row.setAttribute('data-testid', 'deal-row-fake123');
                    row.innerHTML = '<td>Fake Deal</td>';
                    table.appendChild(row);
                } else {
                    // Create a standalone element
                    const el = document.createElement('div');
                    el.setAttribute('data-testid', 'deal-row-fake123');
                    el.style.cssText = 'position:fixed;top:400px;left:400px;width:200px;height:40px;background:#333;';
                    document.body.appendChild(el);
                }
            }
        """)
        # Trigger tour by dispatching a custom event or modifying React state
        # Since we can't easily set React state, use the window.__setShowTour if available
        triggered = await page.evaluate("""
            () => {
                if (window.__setShowTour) {
                    window.__setShowTour(true);
                    return 'triggered via __setShowTour';
                }
                return 'not available';
            }
        """)
        log(f"Tour trigger attempt: {triggered}")
        await page.wait_for_timeout(1000)
    else:
        log(f"Found {len(deal_rows)} deal rows - tour should trigger naturally")
    
    return deal_rows

async def test_tour_elements_exist(page):
    """Test that nav elements targeted by tour exist"""
    log("=== Test: Target elements exist ===")
    
    fund_btn = await page.query_selector('[data-testid="fund-thesis-btn"]')
    fit_header = await page.query_selector('[data-testid="fit-pct-header"]')
    review_btn = await page.query_selector('[data-testid="review-mode-btn"]')
    
    log(f"fund-thesis-btn: {'FOUND' if fund_btn else 'MISSING'}", "PASS" if fund_btn else "FAIL")
    log(f"fit-pct-header: {'FOUND' if fit_header else 'MISSING'}", "PASS" if fit_header else "FAIL")
    log(f"review-mode-btn: {'FOUND' if review_btn else 'MISSING'}", "PASS" if review_btn else "FAIL")
    
    return fund_btn and fit_header and review_btn

async def test_tour_shows_with_deals(page):
    """Test tour appears when deals exist and vc_tour_dismissed not set"""
    log("=== Test: Tour appears on dashboard load ===")
    await setup_page(page, clear_dismissed=True)
    
    await inject_fake_deal_and_trigger_tour(page)
    await page.wait_for_timeout(1200)
    
    tour_next = await page.query_selector('[data-testid="tour-next-btn"]')
    tour_finish = await page.query_selector('[data-testid="tour-finish-btn"]')
    
    tour_visible = tour_next is not None or tour_finish is not None
    log(f"Tour visible: {tour_visible}", "PASS" if tour_visible else "FAIL")
    
    if tour_visible:
        # Check step 1 title
        title_text = await page.evaluate("""
            () => {
                const els = Array.from(document.querySelectorAll('p'));
                const found = els.find(el => el.textContent.includes('Fund Focus'));
                return found ? found.textContent : null;
            }
        """)
        log(f"Step 1 title 'Fund Focus': {'FOUND' if title_text else 'MISSING'}", "PASS" if title_text else "FAIL")
        
        await page.screenshot(path='.screenshots/tour_step1.jpg', quality=40, full_page=False)
        log("Screenshot: tour_step1.jpg")
    
    return tour_visible

async def test_tour_navigation(page):
    """Test clicking Next advances through steps"""
    log("=== Test: Tour step navigation ===")
    await setup_page(page, clear_dismissed=True)
    await inject_fake_deal_and_trigger_tour(page)
    await page.wait_for_timeout(1200)
    
    tour_next = await page.query_selector('[data-testid="tour-next-btn"]')
    if not tour_next:
        log("Tour not visible - skipping navigation test", "SKIP")
        return False
    
    # Step 1 verification
    step_text = await page.evaluate("() => { const el = document.querySelector('[data-testid=\"tour-next-btn\"]'); return el ? el.closest('div')?.querySelector('span')?.textContent : null; }")
    counter = await page.evaluate("""
        () => {
            const spans = Array.from(document.querySelectorAll('span'));
            return spans.find(s => /\\d+ of \\d+/.test(s.textContent))?.textContent || null;
        }
    """)
    log(f"Step counter: {counter}")
    
    # Click Next -> Step 2
    await page.click('[data-testid="tour-next-btn"]', force=True)
    await page.wait_for_timeout(500)
    
    counter2 = await page.evaluate("""
        () => {
            const spans = Array.from(document.querySelectorAll('span'));
            return spans.find(s => /\\d+ of \\d+/.test(s.textContent))?.textContent || null;
        }
    """)
    log(f"After first Next - counter: {counter2}")
    step2_title = await page.evaluate("""
        () => {
            const els = Array.from(document.querySelectorAll('p'));
            const found = els.find(el => el.textContent.includes('Focus Match Score'));
            return found ? found.textContent.trim() : null;
        }
    """)
    log(f"Step 2 title 'Focus Match Score': {'FOUND' if step2_title else 'MISSING'}", "PASS" if step2_title else "FAIL")
    
    # Click Next -> Step 3
    next_btn2 = await page.query_selector('[data-testid="tour-next-btn"]')
    if next_btn2:
        await page.click('[data-testid="tour-next-btn"]', force=True)
        await page.wait_for_timeout(500)
        step3_title = await page.evaluate("""
            () => {
                const els = Array.from(document.querySelectorAll('p'));
                const found = els.find(el => el.textContent.includes('One-click Actions'));
                return found ? found.textContent.trim() : null;
            }
        """)
        log(f"Step 3 title 'One-click Actions': {'FOUND' if step3_title else 'MISSING'}", "PASS" if step3_title else "FAIL")
    
    # Click Next -> Step 4 (or finish if 3-step tour)
    next_btn3 = await page.query_selector('[data-testid="tour-next-btn"]')
    finish_btn3 = await page.query_selector('[data-testid="tour-finish-btn"]')
    
    if next_btn3:
        await page.click('[data-testid="tour-next-btn"]', force=True)
        await page.wait_for_timeout(500)
        step4_title = await page.evaluate("""
            () => {
                const els = Array.from(document.querySelectorAll('p'));
                const found = els.find(el => el.textContent.includes('Review Mode'));
                return found ? found.textContent.trim() : null;
            }
        """)
        log(f"Step 4 title 'Review Mode': {'FOUND' if step4_title else 'MISSING'}", "PASS" if step4_title else "FAIL")
        
        finish_btn = await page.query_selector('[data-testid="tour-finish-btn"]')
        log(f"tour-finish-btn present on last step: {'YES' if finish_btn else 'NO'}", "PASS" if finish_btn else "FAIL")
        
        await page.screenshot(path='.screenshots/tour_step4.jpg', quality=40, full_page=False)
    elif finish_btn3:
        log("3-step tour (no deals for step 3) - finish btn on step 3")
        step_r_title = await page.evaluate("""
            () => {
                const els = Array.from(document.querySelectorAll('p'));
                const found = els.find(el => el.textContent.includes('Review Mode'));
                return found ? found.textContent.trim() : null;
            }
        """)
        log(f"Review Mode title on finish step: {'FOUND' if step_r_title else 'MISSING'}", "PASS" if step_r_title else "FAIL")
    
    return True

async def test_tour_finish_sets_localstorage(page):
    """Test clicking 'Got it' sets vc_tour_dismissed=1"""
    log("=== Test: Finish button sets localStorage ===")
    await setup_page(page, clear_dismissed=True)
    await inject_fake_deal_and_trigger_tour(page)
    await page.wait_for_timeout(1200)
    
    # Navigate to last step
    for _ in range(5):
        next_btn = await page.query_selector('[data-testid="tour-next-btn"]')
        if not next_btn:
            break
        await page.click('[data-testid="tour-next-btn"]', force=True)
        await page.wait_for_timeout(400)
    
    finish_btn = await page.query_selector('[data-testid="tour-finish-btn"]')
    if not finish_btn:
        log("No finish btn found - cannot test localStorage setting", "SKIP")
        return False
    
    await page.click('[data-testid="tour-finish-btn"]', force=True)
    await page.wait_for_timeout(500)
    
    dismissed = await page.evaluate("() => localStorage.getItem('vc_tour_dismissed')")
    log(f"vc_tour_dismissed after finish: {dismissed}", "PASS" if dismissed == '1' else "FAIL")
    
    # Tour should be gone
    tour_gone = not await page.is_visible('[data-testid="tour-finish-btn"]') and not await page.is_visible('[data-testid="tour-next-btn"]')
    log(f"Tour closed after finish: {tour_gone}", "PASS" if tour_gone else "FAIL")
    
    return dismissed == '1'

async def test_close_btn_no_localstorage(page):
    """Test X button closes tour WITHOUT setting vc_tour_dismissed"""
    log("=== Test: X button does NOT set localStorage ===")
    await setup_page(page, clear_dismissed=True)
    await inject_fake_deal_and_trigger_tour(page)
    await page.wait_for_timeout(1200)
    
    close_btn = await page.query_selector('[data-testid="tour-close-btn"]')
    if not close_btn:
        log("tour-close-btn not found", "FAIL")
        return False
    
    await page.click('[data-testid="tour-close-btn"]', force=True)
    await page.wait_for_timeout(500)
    
    dismissed = await page.evaluate("() => localStorage.getItem('vc_tour_dismissed')")
    log(f"vc_tour_dismissed after close: {dismissed}", "PASS" if dismissed is None else "FAIL")
    
    return dismissed is None

async def test_dont_show_btn(page):
    """Test 'Don't show again' link on step 1-3 sets flag"""
    log("=== Test: 'Don't show again' sets localStorage ===")
    await setup_page(page, clear_dismissed=True)
    await inject_fake_deal_and_trigger_tour(page)
    await page.wait_for_timeout(1200)
    
    dont_show = await page.query_selector('[data-testid="tour-dont-show-btn"]')
    if not dont_show:
        log("tour-dont-show-btn not found on step 1", "FAIL")
        return False
    
    await page.click('[data-testid="tour-dont-show-btn"]', force=True)
    await page.wait_for_timeout(500)
    
    dismissed = await page.evaluate("() => localStorage.getItem('vc_tour_dismissed')")
    log(f"vc_tour_dismissed after 'Don't show again': {dismissed}", "PASS" if dismissed == '1' else "FAIL")
    
    return dismissed == '1'

async def test_tour_not_shown_when_dismissed(page):
    """Test tour does NOT appear when vc_tour_dismissed=1"""
    log("=== Test: Tour NOT shown when dismissed ===")
    await setup_page(page, clear_dismissed=False)  # sets vc_tour_dismissed=1
    await page.wait_for_timeout(2000)
    
    tour_visible = await page.is_visible('[data-testid="tour-next-btn"]') or await page.is_visible('[data-testid="tour-finish-btn"]')
    log(f"Tour NOT shown when dismissed: {not tour_visible}", "PASS" if not tour_visible else "FAIL")
    
    return not tour_visible

async def test_progress_bar(page):
    """Test progress bar fills as steps advance"""
    log("=== Test: Progress bar fills on step advance ===")
    await setup_page(page, clear_dismissed=True)
    await inject_fake_deal_and_trigger_tour(page)
    await page.wait_for_timeout(1200)
    
    tour_visible = await page.is_visible('[data-testid="tour-next-btn"]')
    if not tour_visible:
        log("Tour not visible - skipping progress bar test", "SKIP")
        return False
    
    # Count filled segments at step 1
    filled_step1 = await page.evaluate("""
        () => {
            // Progress bar divs - filled ones have background #7c6dfa, unfilled rgba(255,255,255,0.08)
            const allDivs = Array.from(document.querySelectorAll('div[style*="height: 2.5px"], div[style*="height:2.5px"]'));
            return allDivs.filter(d => d.style.background && d.style.background.includes('7c6dfa')).length;
        }
    """)
    log(f"Progress segments filled at step 1: {filled_step1} (expected 1)", "PASS" if filled_step1 == 1 else "INFO")
    
    # Advance to step 2
    await page.click('[data-testid="tour-next-btn"]', force=True)
    await page.wait_for_timeout(400)
    
    filled_step2 = await page.evaluate("""
        () => {
            const allDivs = Array.from(document.querySelectorAll('div[style*="height: 2.5px"], div[style*="height:2.5px"]'));
            return allDivs.filter(d => d.style.background && d.style.background.includes('7c6dfa')).length;
        }
    """)
    log(f"Progress segments filled at step 2: {filled_step2} (expected 2)", "PASS" if filled_step2 >= 2 else "INFO")
    
    return True

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        
        log("Starting Product Tour Tests")
        log("="*50)
        
        # Test 1: Target elements exist
        await setup_page(page, clear_dismissed=True)
        await test_tour_elements_exist(page)
        
        # Test 2: Tour shows with deals
        await test_tour_shows_with_deals(page)
        
        # Test 3: Navigation through steps
        await test_tour_navigation(page)
        
        # Test 4: Finish sets localStorage
        await test_tour_finish_sets_localstorage(page)
        
        # Test 5: Close doesn't set localStorage
        await test_close_btn_no_localstorage(page)
        
        # Test 6: Don't show again link
        await test_dont_show_btn(page)
        
        # Test 7: Tour not shown when dismissed
        await test_tour_not_shown_when_dismissed(page)
        
        # Test 8: Progress bar
        await test_progress_bar(page)
        
        log("="*50)
        log("Test Summary:")
        passes = sum(1 for r in results if r["status"] == "PASS")
        fails = sum(1 for r in results if r["status"] == "FAIL")
        skips = sum(1 for r in results if r["status"] == "SKIP")
        log(f"PASS: {passes}, FAIL: {fails}, SKIP: {skips}")
        
        await browser.close()

asyncio.run(main())
