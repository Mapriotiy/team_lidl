from app.discovery.moldova_tenders import MoldovaTendersDiscovery


class FakeTransport:
    def __init__(self) -> None:
        self.urls: list[str] = []

    def get_json(self, url: str, *, headers: dict[str, str], timeout: float) -> object:
        self.urls.append(url)
        return {
            "data": [
                {
                    "id": "ocds-b3wdp1-MD-1",
                    "title": "Servicii de automatizare a proceselor",
                    "description": "Dezvoltare și implementare software",
                    "buyerRegion": "mun.Chişinău",
                    "procedureType": "openTender",
                    "amount": 1_500_000,
                    "currency": "MDL",
                    "buyerName": "Agenția Servicii Publice",
                    "procedureStatus": "tendering",
                },
                {
                    "id": "ocds-b3wdp1-MD-2",
                    "title": "Licențe software atribuite",
                    "description": "Contract încheiat",
                    "procedureStatus": "awarding",
                },
            ]
        }


def test_search_uses_official_portal_and_keeps_only_active_matching_calls() -> None:
    transport = FakeTransport()
    result = MoldovaTendersDiscovery(transport).search_many(["automatizare procese"])

    assert len(result.calls) == 1
    call = result.calls[0]
    assert call.identifier == "ocds-b3wdp1-MD-1"
    assert call.source == "moldova"
    assert call.currency == "MDL"
    assert call.budget == 1_500_000
    assert call.url == "https://mtender.gov.md/en/tenders/ocds-b3wdp1-MD-1"
    assert "Agenția Servicii Publice" in call.programme
    assert "titlesOrDescriptions=automatizare+procese" in transport.urls[0]

